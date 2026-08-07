// Purpose: End-of-term close — archives results then clears scores; never touches teacher assignments.
import type { Term } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import * as announcementService from "./announcement.service.js";

export async function listActiveSessions() {
  try {
    const [enrollmentSessions, assignmentSessions, archives] = await Promise.all([
      prisma.enrollment.findMany({
        distinct: ["session", "term"],
        select: { session: true, term: true },
        orderBy: [{ session: "desc" }, { term: "asc" }],
      }),
      prisma.teacherSubject.findMany({
        distinct: ["session"],
        select: { session: true },
        orderBy: { session: "desc" },
      }),
      prisma.resultArchive.findMany({
        distinct: ["session", "term"],
        select: { session: true, term: true },
      }),
    ]);

    const keys = new Map<string, { session: string; term: Term | null }>();
    for (const row of enrollmentSessions) {
      keys.set(`${row.session}|${row.term}`, { session: row.session, term: row.term });
    }
    for (const row of archives) {
      const k = `${row.session}|${row.term}`;
      if (!keys.has(k)) keys.set(k, { session: row.session, term: row.term });
    }
    for (const row of assignmentSessions) {
      if (![...keys.keys()].some((x) => x.startsWith(`${row.session}|`))) {
        keys.set(`${row.session}|`, { session: row.session, term: null });
      }
    }

    const details = await Promise.all(
      [...keys.values()].map(async ({ session, term }) => {
        const enrollmentWhere = term ? { session, term } : { session };
        const [enrollments, scores, teacherAssignments, archived] = await Promise.all([
          prisma.enrollment.count({ where: enrollmentWhere }),
          prisma.score.count({ where: { enrollment: enrollmentWhere } }),
          prisma.teacherSubject.count({ where: { session } }),
          term
            ? prisma.resultArchive.count({ where: { session, term } })
            : prisma.resultArchive.count({ where: { session } }),
        ]);
        return { session, term, enrollments, scores, teacherAssignments, archived };
      })
    );

    return details.sort((a, b) => {
      const s = b.session.localeCompare(a.session);
      if (s !== 0) return s;
      return String(a.term ?? "").localeCompare(String(b.term ?? ""));
    });
  } catch (err) {
    console.warn("listActiveSessions full query failed; using legacy session list", err);
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

    return Promise.all(
      sessions.map(async (session) => {
        const [enrollments, scores, teacherAssignments] = await Promise.all([
          prisma.enrollment.count({ where: { session } }),
          prisma.score.count({ where: { enrollment: { session } } }),
          prisma.teacherSubject.count({ where: { session } }),
        ]);
        return {
          session,
          term: null as Term | null,
          enrollments,
          scores,
          teacherAssignments,
          archived: 0,
        };
      })
    );
  }
}

/**
 * Close a term for a session:
 * 1. Archive graded scores into ResultArchive
 * 2. Delete those scores (and optionally enrollments)
 * 3. NEVER delete TeacherSubject, teachers, students, subjects, or classes
 */
export async function closeTerm(input: {
  session: string;
  term: Term;
  clearEnrollments?: boolean;
  actorId?: string;
}) {
  const session = input.session.trim();
  const term = input.term;
  if (session.length < 4) {
    throw new AppError(400, "Session is required (e.g. 2025/2026)");
  }

  const clearEnrollments = input.clearEnrollments !== false;

  const enrollments = await prisma.enrollment.findMany({
    where: { session, term },
    include: {
      score: { include: { teacher: true } },
      subject: true,
      student: { include: { schoolClass: true } },
    },
  });
  const enrollmentIds = enrollments.map((e) => e.id);
  const graded = enrollments.filter((e) => e.score);

  const teacherAssignmentsBefore = await prisma.teacherSubject.count({
    where: { session },
  });

  const result = await prisma.$transaction(async (tx) => {
    if (graded.length > 0) {
      await tx.resultArchive.createMany({
        data: graded.map((e) => ({
          studentId: e.studentId,
          session,
          term,
          subjectCode: e.subject.code,
          subjectTitle: e.subject.title,
          className: e.student.schoolClass.name,
          level: e.student.level,
          assessment: e.score!.assessment,
          exam: e.score!.exam,
          total: e.score!.total,
          grade: e.score!.grade,
          remark: e.score!.remark,
          teacherName: e.score!.teacher
            ? `${e.score!.teacher.firstName} ${e.score!.teacher.lastName}`
            : null,
        })),
      });
    }

    const scoresDeleted =
      enrollmentIds.length > 0
        ? (
            await tx.score.deleteMany({
              where: { enrollmentId: { in: enrollmentIds } },
            })
          ).count
        : 0;

    const enrollmentsDeleted = clearEnrollments
      ? (await tx.enrollment.deleteMany({ where: { session, term } })).count
      : 0;

    const teacherAssignmentsAfter = await tx.teacherSubject.count({
      where: { session },
    });

    return {
      scoresArchived: graded.length,
      scoresDeleted,
      enrollmentsDeleted,
      teacherAssignmentsBefore,
      teacherAssignmentsAfter,
    };
  });

  if (result.teacherAssignmentsAfter !== result.teacherAssignmentsBefore) {
    throw new AppError(500, "Close term aborted: teacher assignments were unexpectedly changed");
  }

  if (input.actorId && result.scoresArchived > 0) {
    await announcementService.createSystemAnnouncement({
      title: `Results archived — ${session} ${term} term`,
      body: `${result.scoresArchived} result(s) for ${session} (${term} term) have been archived. Current scores were cleared for the next term.`,
      audience: "ALL",
      createdById: input.actorId,
    });
  }

  return {
    session,
    term,
    clearEnrollments,
    scoresArchived: result.scoresArchived,
    scoresDeleted: result.scoresDeleted,
    enrollmentsDeleted: result.enrollmentsDeleted,
    teacherAssignmentsPreserved: result.teacherAssignmentsAfter,
    message: `Closed ${session} ${term}: archived ${result.scoresArchived} results, removed ${result.scoresDeleted} live scores${
      clearEnrollments ? ` and ${result.enrollmentsDeleted} enrollments` : ""
    }. Students, teachers, classes, subjects, and teacher assignments were kept.`,
  };
}
