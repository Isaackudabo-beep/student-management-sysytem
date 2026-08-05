// Purpose: End-of-term close — clears scores/enrollments for a session; never touches teacher assignments.
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
export async function listActiveSessions() {
    const [enrollmentSessions, assignmentSessions] = await Promise.all([
        prisma.enrollment.findMany({
            distinct: ["session"],
            select: { session: true },
            orderBy: { session: "desc" },
        }),
        prisma.teacherSubject.findMany({
            distinct: ["session"],
            select: { session: true },
            orderBy: { session: "desc" },
        }),
    ]);
    const sessions = [
        ...new Set([
            ...enrollmentSessions.map((s) => s.session),
            ...assignmentSessions.map((s) => s.session),
        ]),
    ].sort((a, b) => b.localeCompare(a));
    const details = await Promise.all(sessions.map(async (session) => {
        const [enrollments, scores, teacherAssignments] = await Promise.all([
            prisma.enrollment.count({ where: { session } }),
            prisma.score.count({ where: { enrollment: { session } } }),
            prisma.teacherSubject.count({ where: { session } }),
        ]);
        return { session, enrollments, scores, teacherAssignments };
    }));
    return details;
}
/**
 * Close a term/session for students:
 * - Deletes scores for enrollments in that session
 * - Optionally deletes those enrollments (default true) so the student portal clears
 * - NEVER deletes TeacherSubject rows, teachers, students, subjects, or classes
 */
export async function closeTerm(input) {
    const session = input.session.trim();
    if (session.length < 4) {
        throw new AppError(400, "Session is required (e.g. 2025/2026)");
    }
    const clearEnrollments = input.clearEnrollments !== false;
    const enrollments = await prisma.enrollment.findMany({
        where: { session },
        select: { id: true },
    });
    const enrollmentIds = enrollments.map((e) => e.id);
    const teacherAssignmentsBefore = await prisma.teacherSubject.count({
        where: { session },
    });
    const result = await prisma.$transaction(async (tx) => {
        const scoresDeleted = enrollmentIds.length > 0
            ? (await tx.score.deleteMany({
                where: { enrollmentId: { in: enrollmentIds } },
            })).count
            : 0;
        const enrollmentsDeleted = clearEnrollments
            ? (await tx.enrollment.deleteMany({
                where: { session },
            })).count
            : 0;
        const teacherAssignmentsAfter = await tx.teacherSubject.count({
            where: { session },
        });
        return {
            scoresDeleted,
            enrollmentsDeleted,
            teacherAssignmentsBefore,
            teacherAssignmentsAfter,
        };
    });
    if (result.teacherAssignmentsAfter !== result.teacherAssignmentsBefore) {
        throw new AppError(500, "Close term aborted: teacher assignments were unexpectedly changed");
    }
    return {
        session,
        clearEnrollments,
        scoresDeleted: result.scoresDeleted,
        enrollmentsDeleted: result.enrollmentsDeleted,
        teacherAssignmentsPreserved: result.teacherAssignmentsAfter,
        message: clearEnrollments
            ? `Closed ${session}: removed ${result.scoresDeleted} scores and ${result.enrollmentsDeleted} enrollments. Teacher assignments were kept.`
            : `Closed ${session}: removed ${result.scoresDeleted} scores (enrollments kept as Awaiting Result). Teacher assignments were kept.`,
    };
}
