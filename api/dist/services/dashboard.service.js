// Purpose: Role-aware dashboard statistics + chart metrics for secondary school SMS.
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { requireSchoolId } from "../lib/schoolScope.js";
import * as announcementService from "./announcement.service.js";
export async function getDashboardStats(actor) {
    const schoolId = requireSchoolId(actor);
    let notifications = [];
    try {
        notifications = await announcementService.getInbox(actor);
    }
    catch (err) {
        console.warn("dashboard notifications unavailable", err);
    }
    const unreadNotifications = notifications.filter((n) => !n.read).length;
    if (actor.role === "ADMIN") {
        const [students, teachers, subjects, classes, enrollments, scores, promoted, repeating] = await Promise.all([
            prisma.student.count({ where: { schoolId } }),
            prisma.teacher.count({ where: { schoolId } }),
            prisma.subject.count({ where: { schoolId } }),
            prisma.schoolClass.count({ where: { schoolId } }),
            prisma.enrollment.count({ where: { student: { schoolId } } }),
            prisma.score.count({ where: { enrollment: { student: { schoolId } } } }),
            prisma.student.count({ where: { schoolId, academicStatus: "PROMOTED" } }),
            prisma.student.count({ where: { schoolId, academicStatus: "REPEATING" } }),
        ]);
        let resultsPending = 0;
        let resultsApproved = 0;
        let resultsPublished = 0;
        let resultsReturned = 0;
        try {
            const [pending, approved, published, returned] = await Promise.all([
                prisma.score.count({
                    where: {
                        enrollment: { student: { schoolId } },
                        status: { in: ["SUBMITTED", "DRAFT"] },
                    },
                }),
                prisma.score.count({
                    where: { enrollment: { student: { schoolId } }, status: "APPROVED" },
                }),
                prisma.score.count({
                    where: { enrollment: { student: { schoolId } }, status: "PUBLISHED" },
                }),
                prisma.score.count({
                    where: { enrollment: { student: { schoolId } }, status: "RETURNED" },
                }),
            ]);
            resultsPending = pending;
            resultsApproved = approved;
            resultsPublished = published;
            resultsReturned = returned;
        }
        catch {
            /* status column may not exist yet */
        }
        const allScores = await prisma.score.findMany({
            where: { enrollment: { student: { schoolId } } },
            select: {
                total: true,
                grade: true,
                enrollment: {
                    select: {
                        student: {
                            select: {
                                classId: true,
                                schoolClass: { select: { name: true, level: true } },
                            },
                        },
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
            where: { schoolId },
            orderBy: [{ level: "asc" }, { name: "asc" }],
            select: {
                name: true,
                _count: { select: { students: true } },
            },
        });
        const [recentEnrollments, recentScores, recentAnnouncements] = await Promise.all([
            prisma.enrollment.findMany({
                where: { student: { schoolId } },
                take: 5,
                orderBy: { createdAt: "desc" },
                select: {
                    createdAt: true,
                    student: { select: { firstName: true, lastName: true } },
                    subject: { select: { code: true } },
                },
            }),
            prisma.score.findMany({
                where: { enrollment: { student: { schoolId } } },
                take: 5,
                orderBy: { updatedAt: "desc" },
                select: {
                    total: true,
                    updatedAt: true,
                    enrollment: {
                        select: {
                            student: { select: { firstName: true } },
                            subject: { select: { code: true } },
                        },
                    },
                },
            }),
            prisma.announcement.findMany({
                where: { schoolId },
                take: 5,
                orderBy: { publishedAt: "desc" },
                select: { title: true, publishedAt: true },
            }),
        ]);
        const gradeGroups = await prisma.score.groupBy({
            by: ["grade"],
            where: { enrollment: { student: { schoolId } } },
            _count: { grade: true },
        });
        return {
            role: actor.role,
            counts: {
                students,
                teachers,
                subjects,
                classes,
                enrollments,
                scores,
                unreadNotifications,
                resultsPending,
                resultsApproved,
                resultsPublished,
                resultsReturned,
                studentsPromoted: promoted,
                studentsRepeating: repeating,
            },
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
                { label: "Enter / review scores", href: "/scores" },
                { label: "Approve results", href: "/results-review" },
                { label: "Broadsheet", href: "/broadsheet" },
                { label: "Promotion", href: "/promotion" },
                { label: "Close term", href: "/term" },
                { label: "Register student", href: "/students" },
            ],
            notifications: notifications.slice(0, 5),
        };
    }
    if (actor.role === "TEACHER") {
        if (!actor.teacherId)
            throw new AppError(403, "Teacher profile not found");
        const schoolId = requireSchoolId(actor);
        const assignments = await prisma.teacherSubject.findMany({
            where: { teacherId: actor.teacherId, teacher: { schoolId }, subject: { schoolId } },
            select: {
                session: true,
                subjectId: true,
                subject: { select: { id: true, code: true, title: true, level: true } },
            },
        });
        const assignmentKeys = assignments.map((a) => ({ subjectId: a.subjectId, session: a.session }));
        const enrollments = assignmentKeys.length === 0
            ? []
            : await prisma.enrollment.findMany({
                where: { OR: assignmentKeys, student: { schoolId }, subject: { schoolId } },
                select: {
                    id: true,
                    session: true,
                    score: { select: { id: true } },
                    subject: { select: { code: true } },
                    student: {
                        select: {
                            firstName: true,
                            lastName: true,
                            schoolClass: { select: { name: true } },
                        },
                    },
                },
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
            })),
            notifications: notifications.slice(0, 5),
        };
    }
    if (actor.role === "STUDENT") {
        if (!actor.studentId)
            throw new AppError(403, "Student profile not found");
        let student = null;
        try {
            student = await prisma.student.findUnique({
                where: { id: actor.studentId },
                select: {
                    firstName: true,
                    lastName: true,
                    admissionNumber: true,
                    level: true,
                    phone: true,
                    parentName: true,
                    parentPhone: true,
                    address: true,
                    gender: true,
                    dateOfBirth: true,
                    academicStatus: true,
                    schoolClass: { select: { name: true } },
                },
            });
        }
        catch {
            student = await prisma.student.findUnique({
                where: { id: actor.studentId },
                select: {
                    firstName: true,
                    lastName: true,
                    admissionNumber: true,
                    level: true,
                    phone: true,
                    parentName: true,
                    parentPhone: true,
                    address: true,
                    gender: true,
                    dateOfBirth: true,
                    schoolClass: { select: { name: true } },
                },
            });
        }
        let enrollments = [];
        try {
            enrollments = await prisma.enrollment.findMany({
                where: { studentId: actor.studentId },
                select: {
                    id: true,
                    session: true,
                    term: true,
                    subject: { select: { code: true, title: true } },
                    score: {
                        select: {
                            assessment: true,
                            exam: true,
                            total: true,
                            grade: true,
                            remark: true,
                            status: true,
                        },
                    },
                },
                orderBy: { createdAt: "asc" },
            });
        }
        catch {
            enrollments = await prisma.enrollment.findMany({
                where: { studentId: actor.studentId },
                select: {
                    id: true,
                    session: true,
                    subject: { select: { code: true, title: true } },
                    score: {
                        select: {
                            assessment: true,
                            exam: true,
                            total: true,
                            grade: true,
                            remark: true,
                        },
                    },
                },
                orderBy: { createdAt: "asc" },
            });
        }
        const visibleScore = (e) => {
            if (!e.score)
                return null;
            const status = e.score.status;
            if (status && status !== "PUBLISHED")
                return null;
            return e.score;
        };
        const graded = enrollments.filter((e) => visibleScore(e));
        const average = graded.length > 0
            ? Number((graded.reduce((s, e) => s + (visibleScore(e)?.total ?? 0), 0) / graded.length).toFixed(2))
            : null;
        const classDisplay = student?.academicStatus === "REPEATING"
            ? `Repeated · ${student.schoolClass?.name}`
            : student?.schoolClass?.name ?? null;
        return {
            role: actor.role,
            profile: student
                ? {
                    fullName: `${student.firstName} ${student.lastName}`,
                    admissionNumber: student.admissionNumber,
                    className: classDisplay,
                    level: student.level,
                    academicStatus: student.academicStatus ?? "ACTIVE",
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
            subjects: enrollments.map((e) => {
                const score = visibleScore(e);
                return {
                    enrollmentId: e.id,
                    code: e.subject.code,
                    title: e.subject.title,
                    session: e.session,
                    term: e.term ?? "FIRST",
                    resultStatus: score ? "GRADED" : "AWAITING_RESULT",
                    resultStatusLabel: score ? "Graded" : "Awaiting Result",
                    assessment: score?.assessment ?? null,
                    exam: score?.exam ?? null,
                    total: score?.total ?? null,
                    grade: score?.grade ?? null,
                    remark: score?.remark ?? null,
                };
            }),
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
