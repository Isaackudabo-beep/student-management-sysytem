// Purpose: Score entry — teachers only for subjects they teach; server computes grade.
import { AppError, assertFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { assertSchoolMatch, requireSchoolId } from "../lib/schoolScope.js";
import { enrollmentBaseSelect, enrollmentSelectWithTerm, isSchemaMismatch, studentBaseSelect, studentSelectWithStatus, withAcademicStatus, withTerm, } from "../lib/safeSelects.js";
async function assertTeacherCanScore(teacherId, subjectId, session) {
    const assignment = await prisma.teacherSubject.findFirst({
        where: { teacherId, subjectId, session },
    });
    if (!assignment) {
        throw new AppError(403, "You can only enter scores for subjects you teach in this session");
    }
}
export async function upsertScore(input, actor) {
    const { upsertScoreWithWorkflow } = await import("./resultWorkflow.service.js");
    return upsertScoreWithWorkflow(input, actor);
}
export async function listScores(params) {
    const { actor } = params;
    const schoolId = requireSchoolId(actor);
    if (actor.role === "STUDENT") {
        if (!actor.studentId) {
            throw new AppError(403, "Student profile not found");
        }
        params.studentId = actor.studentId;
    }
    let assignmentOr;
    if (actor.role === "TEACHER") {
        if (!actor.teacherId)
            throw new AppError(403, "Teacher profile not found");
        const assignments = await prisma.teacherSubject.findMany({
            where: { teacherId: actor.teacherId, ...(params.session ? { session: params.session } : {}) },
        });
        if (assignments.length === 0) {
            return {
                data: [],
                meta: { total: 0, page: params.page, limit: params.limit, pages: 0 },
            };
        }
        assignmentOr = assignments.map((a) => ({ subjectId: a.subjectId, session: a.session }));
    }
    function buildEnrollmentFilter(includeTerm) {
        const base = {
            student: {
                schoolId,
                ...(params.classId ? { classId: params.classId } : {}),
            },
            ...(params.studentId ? { studentId: params.studentId } : {}),
            ...(params.subjectId ? { subjectId: params.subjectId } : {}),
            ...(params.session ? { session: params.session } : {}),
            ...(includeTerm && params.term ? { term: params.term } : {}),
            ...(assignmentOr ? { OR: assignmentOr } : {}),
        };
        return base;
    }
    async function fetch(includeTerm, enrollmentSelect, studentSelect, includeWorkflowFields) {
        const enrollmentFilter = buildEnrollmentFilter(includeTerm);
        const where = {
            enrollment: enrollmentFilter,
            ...(actor.role === "STUDENT" && includeWorkflowFields ? { status: "PUBLISHED" } : {}),
        };
        const [total, rows] = await Promise.all([
            prisma.score.count({ where }),
            prisma.score.findMany({
                where,
                skip: (params.page - 1) * params.limit,
                take: params.limit,
                orderBy: { updatedAt: "desc" },
                select: {
                    id: true,
                    enrollmentId: true,
                    teacherId: true,
                    assessment: true,
                    exam: true,
                    total: true,
                    grade: true,
                    remark: true,
                    ...(includeWorkflowFields
                        ? {
                            status: true,
                            returnNote: true,
                            submittedAt: true,
                            approvedAt: true,
                            publishedAt: true,
                        }
                        : {}),
                    createdAt: true,
                    updatedAt: true,
                    teacher: true,
                    enrollment: {
                        select: {
                            ...enrollmentSelect,
                            student: { select: studentSelect },
                            subject: true,
                        },
                    },
                },
            }),
        ]);
        const mapped = rows.map((row) => ({
            ...row,
            enrollment: withTerm({
                ...row.enrollment,
                student: withAcademicStatus(row.enrollment.student),
            }),
        }));
        return {
            data: mapped,
            meta: { total, page: params.page, limit: params.limit, pages: Math.ceil(total / params.limit) || 1 },
        };
    }
    try {
        return await fetch(true, enrollmentSelectWithTerm, studentSelectWithStatus, true);
    }
    catch (err) {
        if (!isSchemaMismatch(err))
            throw err;
        try {
            return await fetch(true, enrollmentSelectWithTerm, studentSelectWithStatus, false);
        }
        catch (err2) {
            if (!isSchemaMismatch(err2))
                throw err2;
            return fetch(false, enrollmentBaseSelect, studentBaseSelect, false);
        }
    }
}
export async function getStudentResults(studentId, actor) {
    const schoolId = requireSchoolId(actor);
    if (actor.role === "STUDENT" && actor.studentId !== studentId) {
        throw new AppError(403, "Students can only view their own results");
    }
    let student;
    try {
        student = assertFound(await prisma.student.findFirst({
            where: { id: studentId, schoolId },
            select: {
                ...studentSelectWithStatus,
                schoolClass: true,
                user: { select: { fullName: true } },
            },
        }), "Student not found");
    }
    catch (err) {
        if (!isSchemaMismatch(err))
            throw err;
        student = assertFound(await prisma.student.findFirst({
            where: { id: studentId, schoolId },
            select: {
                ...studentBaseSelect,
                schoolClass: true,
                user: { select: { fullName: true } },
            },
        }), "Student not found");
    }
    student = withAcademicStatus(student);
    let enrollments;
    try {
        enrollments = await prisma.enrollment.findMany({
            where: { studentId, student: { schoolId } },
            include: {
                subject: true,
                score: { include: { teacher: true } },
            },
            orderBy: [{ session: "desc" }, { term: "asc" }, { createdAt: "asc" }],
        });
    }
    catch (err) {
        if (!isSchemaMismatch(err))
            throw err;
        enrollments = await prisma.enrollment.findMany({
            where: { studentId, student: { schoolId } },
            include: {
                subject: true,
                score: { include: { teacher: true } },
            },
            orderBy: [{ session: "desc" }, { createdAt: "asc" }],
        });
    }
    let archived = [];
    try {
        archived = await prisma.resultArchive.findMany({
            where: { studentId, student: { schoolId } },
            orderBy: [{ session: "desc" }, { term: "asc" }, { archivedAt: "desc" }],
        });
    }
    catch {
        archived = [];
    }
    const isStudent = actor.role === "STUDENT";
    const scored = enrollments.filter((e) => {
        if (!e.score)
            return false;
        if (isStudent)
            return e.score.status === "PUBLISHED" || !e.score.status;
        return true;
    });
    // After migration, students only count published; before status column exists, status is undefined → show (legacy)
    const visibleScored = enrollments.filter((e) => {
        if (!e.score)
            return false;
        if (!isStudent)
            return true;
        const status = e.score.status;
        return !status || status === "PUBLISHED";
    });
    const average = visibleScored.length > 0
        ? Number((visibleScored.reduce((sum, e) => sum + (e.score?.total ?? 0), 0) / visibleScored.length).toFixed(2))
        : null;
    const sessions = [...new Set([...enrollments.map((e) => e.session), ...archived.map((a) => a.session)])];
    const classDisplay = student.academicStatus === "REPEATING"
        ? `Repeated · ${student.schoolClass?.name ?? student.level}`
        : student.schoolClass?.name ?? student.level;
    return {
        student: {
            id: student.id,
            fullName: student.user?.fullName ?? `${student.firstName} ${student.lastName}`,
            firstName: student.firstName,
            lastName: student.lastName,
            admissionNumber: student.admissionNumber,
            className: classDisplay,
            level: student.level,
            department: student.department,
            academicStatus: student.academicStatus,
            academicStatusLabel: student.academicStatus === "REPEATING"
                ? "Repeated"
                : student.academicStatus === "PROMOTED"
                    ? "Promoted"
                    : "Active",
            parentName: student.parentName,
            parentPhone: student.parentPhone,
            address: student.address,
            phone: student.phone,
            email: student.email,
            gender: student.gender,
            dateOfBirth: student.dateOfBirth,
        },
        sessions,
        enrollments: enrollments.map((e) => {
            const row = withTerm(e);
            const status = e.score?.status;
            const hiddenFromStudent = isStudent && e.score && status && status !== "PUBLISHED";
            if (hiddenFromStudent) {
                return {
                    ...row,
                    score: null,
                    resultStatus: "AWAITING_RESULT",
                    resultStatusLabel: "Awaiting Result",
                    caScore: null,
                    examScore: null,
                    workflowStatus: status,
                };
            }
            return {
                ...row,
                resultStatus: e.score ? (status === "PUBLISHED" || !status ? "GRADED" : status) : "AWAITING_RESULT",
                resultStatusLabel: e.score
                    ? !status || status === "PUBLISHED"
                        ? "Graded"
                        : status === "SUBMITTED"
                            ? "Submitted"
                            : status === "APPROVED"
                                ? "Approved"
                                : status === "RETURNED"
                                    ? "Returned"
                                    : status === "DRAFT"
                                        ? "Draft"
                                        : "Graded"
                    : "Awaiting Result",
                caScore: e.score?.assessment ?? null,
                examScore: e.score?.exam ?? null,
                workflowStatus: status ?? null,
            };
        }),
        archivedResults: archived,
        summary: {
            enrolled: enrollments.length,
            graded: visibleScored.length,
            awaiting: enrollments.length - visibleScored.length,
            average,
        },
    };
}
export async function deleteScore(id, actor) {
    requireSchoolId(actor);
    const score = assertFound(await prisma.score.findUnique({
        where: { id },
        include: { enrollment: { include: { student: true } } },
    }), "Score not found");
    assertSchoolMatch(actor, score.enrollment.student.schoolId, "Score");
    if (actor.role === "TEACHER") {
        if (!actor.teacherId || score.teacherId !== actor.teacherId) {
            throw new AppError(403, "You can only delete scores you entered");
        }
        if (score.status === "APPROVED" || score.status === "PUBLISHED") {
            throw new AppError(400, "Approved/published scores cannot be deleted. Ask an admin to return them first.");
        }
        await assertTeacherCanScore(actor.teacherId, score.enrollment.subjectId, score.enrollment.session);
    }
    else if (actor.role !== "ADMIN") {
        throw new AppError(403, "Not allowed");
    }
    await prisma.score.delete({ where: { id } });
    return { message: "Score deleted" };
}
