// Purpose: Role-aware dashboard statistics + chart metrics for secondary school SMS.
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import * as announcementService from "./announcement.service.js";
export async function getDashboardStats(actor) {
    const notifications = await announcementService.getInbox(actor);
    const unreadNotifications = notifications.filter((n) => !n.read).length;
    if (actor.role === "ADMIN") {
        const [students, teachers, subjects, classes, enrollments, scores] = await Promise.all([
            prisma.student.count(),
            prisma.teacher.count(),
            prisma.subject.count(),
            prisma.schoolClass.count(),
            prisma.enrollment.count(),
            prisma.score.count(),
        ]);
        const allScores = await prisma.score.findMany({
            select: {
                total: true,
                grade: true,
                enrollment: {
                    select: {
                        student: { select: { classId: true, schoolClass: { select: { name: true, level: true } } } },
                    },
                },
            },
        });
        const passCount = allScores.filter((s) => s.total >= 40).length;
        const overallPassRate = allScores.length > 0 ? Number(((passCount / allScores.length) * 100).toFixed(1)) : 0;
        const byClassMap = new Map();
        for (const s of allScores) {
            const name = s.enrollment.student.schoolClass?.name ?? "Unknown";
            const row = byClassMap.get(name) ?? { name, pass: 0, total: 0 };
            row.total += 1;
            if (s.total >= 40)
                row.pass += 1;
            byClassMap.set(name, row);
        }
        const passRateByClass = [...byClassMap.values()]
            .map((c) => ({
            className: c.name,
            passRate: c.total ? Number(((c.pass / c.total) * 100).toFixed(1)) : 0,
            scored: c.total,
        }))
            .sort((a, b) => a.className.localeCompare(b.className));
        const populationByClass = await prisma.schoolClass.findMany({
            orderBy: [{ level: "asc" }, { name: "asc" }],
            include: { _count: { select: { students: true } } },
        });
        const [recentEnrollments, recentScores, recentAnnouncements] = await Promise.all([
            prisma.enrollment.findMany({
                take: 5,
                orderBy: { createdAt: "desc" },
                include: { student: true, subject: true },
            }),
            prisma.score.findMany({
                take: 5,
                orderBy: { updatedAt: "desc" },
                include: {
                    enrollment: { include: { student: true, subject: true } },
                    teacher: true,
                },
            }),
            prisma.announcement.findMany({ take: 5, orderBy: { publishedAt: "desc" } }),
        ]);
        const gradeGroups = await prisma.score.groupBy({
            by: ["grade"],
            _count: { grade: true },
        });
        return {
            role: actor.role,
            counts: { students, teachers, subjects, classes, enrollments, scores, unreadNotifications },
            charts: {
                overallPassRate,
                passRateByClass,
                studentPopulation: populationByClass.map((c) => ({
                    className: c.name,
                    count: c._count.students,
                })),
                teacherCount: teachers,
            },
            gradeDistribution: gradeGroups.map((g) => ({ grade: g.grade, count: g._count.grade })),
            recentActivities: [
                ...recentEnrollments.map((e) => ({
                    type: "ENROLLMENT",
                    at: e.createdAt,
                    summary: `${e.student.firstName} ${e.student.lastName} enrolled in ${e.subject.code}`,
                })),
                ...recentScores.map((s) => ({
                    type: "SCORE",
                    at: s.updatedAt,
                    summary: `${s.enrollment.student.firstName} scored ${s.total} in ${s.enrollment.subject.code}`,
                })),
                ...recentAnnouncements.map((a) => ({
                    type: "ANNOUNCEMENT",
                    at: a.publishedAt,
                    summary: `Announcement: ${a.title}`,
                })),
            ]
                .sort((a, b) => +new Date(b.at) - +new Date(a.at))
                .slice(0, 8),
            quickActions: [
                { label: "Register student", href: "/students" },
                { label: "Close term", href: "/term" },
                { label: "Promote students", href: "/term" },
                { label: "Manage classes", href: "/classes" },
                { label: "Send notification", href: "/announcements" },
                { label: "Manage teachers", href: "/teachers" },
            ],
            notifications: notifications.slice(0, 5),
        };
    }
    if (actor.role === "TEACHER") {
        if (!actor.teacherId)
            throw new AppError(403, "Teacher profile not found");
        const assignments = await prisma.teacherSubject.findMany({
            where: { teacherId: actor.teacherId },
            include: { subject: true },
        });
        const assignmentKeys = assignments.map((a) => ({ subjectId: a.subjectId, session: a.session }));
        const enrollments = assignmentKeys.length === 0
            ? []
            : await prisma.enrollment.findMany({
                where: { OR: assignmentKeys },
                include: { score: true, subject: true, student: { include: { schoolClass: true } } },
            });
        const pendingScores = enrollments.filter((e) => !e.score).length;
        const classes = [
            ...new Set(enrollments
                .map((e) => e.student.schoolClass?.name)
                .filter((n) => Boolean(n))),
        ];
        return {
            role: actor.role,
            counts: {
                assignedSubjects: assignments.length,
                enrollmentsInSubjects: enrollments.length,
                pendingScores,
                scoresEntered: enrollments.length - pendingScores,
                unreadNotifications,
            },
            subjects: assignments.map((a) => ({
                id: a.subject.id,
                code: a.subject.code,
                title: a.subject.title,
                level: a.subject.level,
                session: a.session,
            })),
            classes,
            pending: enrollments
                .filter((e) => !e.score)
                .slice(0, 10)
                .map((e) => ({
                enrollmentId: e.id,
                student: `${e.student.firstName} ${e.student.lastName}`,
                subject: e.subject.code,
                className: e.student.schoolClass?.name,
                session: e.session,
                term: e.term,
            })),
            notifications: notifications.slice(0, 5),
        };
    }
    if (actor.role === "STUDENT") {
        if (!actor.studentId)
            throw new AppError(403, "Student profile not found");
        const student = await prisma.student.findUnique({
            where: { id: actor.studentId },
            include: { schoolClass: true },
        });
        const enrollments = await prisma.enrollment.findMany({
            where: { studentId: actor.studentId },
            include: { score: true, subject: true },
            orderBy: [{ session: "desc" }, { term: "asc" }],
        });
        const graded = enrollments.filter((e) => e.score);
        const average = graded.length > 0
            ? Number((graded.reduce((s, e) => s + (e.score?.total ?? 0), 0) / graded.length).toFixed(2))
            : null;
        const classDisplay = student?.academicStatus === "REPEATING"
            ? `Repeated · ${student.schoolClass.name}`
            : student?.schoolClass.name ?? null;
        return {
            role: actor.role,
            profile: student
                ? {
                    fullName: `${student.firstName} ${student.lastName}`,
                    admissionNumber: student.admissionNumber,
                    className: classDisplay,
                    level: student.level,
                    academicStatus: student.academicStatus,
                    academicStatusLabel: student.academicStatus === "REPEATING"
                        ? "Repeated"
                        : student.academicStatus === "PROMOTED"
                            ? "Promoted"
                            : "Active",
                    phone: student.phone,
                    parentName: student.parentName,
                    parentPhone: student.parentPhone,
                    address: student.address,
                    gender: student.gender,
                    dateOfBirth: student.dateOfBirth,
                }
                : null,
            counts: {
                enrolledSubjects: enrollments.length,
                gradedSubjects: graded.length,
                awaitingResults: enrollments.length - graded.length,
                average,
                unreadNotifications,
            },
            subjects: enrollments.map((e) => ({
                enrollmentId: e.id,
                code: e.subject.code,
                title: e.subject.title,
                session: e.session,
                term: e.term,
                resultStatus: e.score ? "GRADED" : "AWAITING_RESULT",
                resultStatusLabel: e.score ? "Graded" : "Awaiting Result",
                assessment: e.score?.assessment ?? null,
                exam: e.score?.exam ?? null,
                total: e.score?.total ?? null,
                grade: e.score?.grade ?? null,
                remark: e.score?.remark ?? null,
            })),
            academicSummary: {
                average,
                graded: graded.length,
                awaiting: enrollments.length - graded.length,
            },
            notifications: notifications.slice(0, 5),
        };
    }
    throw new AppError(403, "Unknown role");
}
