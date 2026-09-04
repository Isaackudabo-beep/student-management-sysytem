// Purpose: Promote / repeat students after Third Term using cumulative average ≥ 45%.
import type { Term } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { isTerminalLevel, nextLevel, PASS_AVERAGE } from "../utils/levels.js";
import * as announcementService from "./announcement.service.js";

async function thirdTermAverage(studentId: string, session: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId, session, term: "THIRD" },
    include: { score: true },
  });

  let totals = enrollments.filter((e) => e.score).map((e) => e.score!.total);
  if (totals.length === 0) {
    const archived = await prisma.resultArchive.findMany({
      where: { studentId, session, term: "THIRD" },
    });
    totals = archived.map((a) => a.total);
  }

  if (totals.length === 0) return null;
  return Number((totals.reduce((s, t) => s + t, 0) / totals.length).toFixed(2));
}

export async function previewPromotion(input: {
  session: string;
  term: Term;
  schoolId: string;
  classId?: string;
}) {
  if (input.term !== "THIRD") {
    throw new AppError(400, "Promotion runs only after the THIRD term");
  }

  const students = await prisma.student.findMany({
    where: {
      schoolId: input.schoolId,
      ...(input.classId ? { classId: input.classId } : {}),
    },
    include: { schoolClass: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const rows = [];
  for (const student of students) {
    const average = await thirdTermAverage(student.id, input.session.trim());
    let recommendation: "PROMOTE" | "REPEAT" | "SKIP" = "SKIP";
    let reason = "No third-term scores found";
    let nextClassName: string | null = null;

    if (average != null) {
      if (average >= PASS_AVERAGE) {
        recommendation = "PROMOTE";
        reason = `Average ${average}% ≥ ${PASS_AVERAGE}%`;
        if (isTerminalLevel(student.level)) {
          nextClassName = "Graduated (SS3)";
        } else {
          const nxt = nextLevel(student.level);
          if (nxt) {
            const nextClass = await prisma.schoolClass.findFirst({
              where: {
                schoolId: input.schoolId,
                level: { equals: nxt, mode: "insensitive" },
                ...(student.schoolClass.arm
                  ? { arm: { equals: student.schoolClass.arm, mode: "insensitive" } }
                  : {}),
              },
              orderBy: { name: "asc" },
            });
            nextClassName = nextClass?.name ?? `Missing class for ${nxt}`;
            if (!nextClass) {
              recommendation = "SKIP";
              reason = `No class found for level ${nxt}`;
            }
          }
        }
      } else {
        recommendation = "REPEAT";
        reason = `Average ${average}% < ${PASS_AVERAGE}%`;
      }
    }

    rows.push({
      studentId: student.id,
      name: `${student.lastName}, ${student.firstName}`,
      admissionNumber: student.admissionNumber,
      currentClass: student.schoolClass.name,
      level: student.level,
      academicStatus: student.academicStatus,
      average,
      position: null as number | null,
      recommendation,
      reason,
      nextClassName,
      alreadyProcessed:
        student.academicStatus === "PROMOTED" || student.academicStatus === "REPEATING",
    });
  }

  const withAvg = rows
    .filter((r) => r.average != null)
    .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
  let lastAvg: number | null = null;
  let lastPos = 0;
  withAvg.forEach((r, idx) => {
    if (r.average !== lastAvg) {
      lastPos = idx + 1;
      lastAvg = r.average;
    }
    r.position = lastPos;
  });

  return {
    session: input.session.trim(),
    term: input.term,
    passAverage: PASS_AVERAGE,
    students: rows,
    summary: {
      total: rows.length,
      promote: rows.filter((r) => r.recommendation === "PROMOTE").length,
      repeat: rows.filter((r) => r.recommendation === "REPEAT").length,
      skip: rows.filter((r) => r.recommendation === "SKIP").length,
      alreadyProcessed: rows.filter((r) => r.alreadyProcessed).length,
    },
  };
}

async function applyPromoteOne(
  student: {
    id: string;
    schoolId: string;
    userId: string;
    firstName: string;
    lastName: string;
    level: string;
    schoolClass: { name: string; arm: string | null };
  },
  session: string,
  actorId: string,
  schoolId: string,
  force?: "promote" | "repeat"
) {
  const average = await thirdTermAverage(student.id, session);
  if (average == null) {
    return {
      type: "skipped" as const,
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      reason: "No third-term scores found",
    };
  }

  const name = `${student.firstName} ${student.lastName}`;
  const shouldPromote = force ? force === "promote" : average >= PASS_AVERAGE;

  if (shouldPromote) {
    if (isTerminalLevel(student.level)) {
      await prisma.student.update({
        where: { id: student.id },
        data: { academicStatus: "PROMOTED" },
      });
      await announcementService.createSystemAnnouncement({
        schoolId: student.schoolId,
        title: "Congratulations — you completed SS3",
        body: `Your third-term average for ${session} was ${average}%. You have completed secondary school.`,
        audience: "USER",
        createdById: actorId,
        targetUserId: student.userId,
      });
      return {
        type: "promoted" as const,
        id: student.id,
        name,
        from: student.schoolClass.name,
        to: "Graduated (SS3)",
      };
    }

    const nxt = nextLevel(student.level);
    if (!nxt) {
      return { type: "skipped" as const, id: student.id, name, reason: "No next level mapping" };
    }

    const nextClass = await prisma.schoolClass.findFirst({
      where: {
        schoolId,
        level: { equals: nxt, mode: "insensitive" },
        ...(student.schoolClass.arm
          ? { arm: { equals: student.schoolClass.arm, mode: "insensitive" } }
          : {}),
      },
      orderBy: { name: "asc" },
    });

    if (!nextClass) {
      return {
        type: "skipped" as const,
        id: student.id,
        name,
        reason: `No class found for level ${nxt}${student.schoolClass.arm ? ` arm ${student.schoolClass.arm}` : ""}. Create it under Classes first.`,
      };
    }

    await prisma.student.update({
      where: { id: student.id },
      data: {
        classId: nextClass.id,
        level: nextClass.level,
        academicStatus: "PROMOTED",
      },
    });

    await announcementService.createSystemAnnouncement({
      schoolId: student.schoolId,
      title: "You have been promoted",
      body: `Your third-term average for ${session} was ${average}% (≥ ${PASS_AVERAGE}%). You move from ${student.schoolClass.name} to ${nextClass.name}.`,
      audience: "USER",
      createdById: actorId,
      targetUserId: student.userId,
    });

    return {
      type: "promoted" as const,
      id: student.id,
      name,
      from: student.schoolClass.name,
      to: nextClass.name,
    };
  }

  await prisma.student.update({
    where: { id: student.id },
    data: { academicStatus: "REPEATING" },
  });
  await announcementService.createSystemAnnouncement({
    schoolId: student.schoolId,
    title: "Class repeat notice",
    body: `Your third-term average for ${session} was ${average}% (below ${PASS_AVERAGE}%). You will repeat ${student.schoolClass.name}. Your portal shows “Repeated”.`,
    audience: "USER",
    createdById: actorId,
    targetUserId: student.userId,
  });

  return {
    type: "repeating" as const,
    id: student.id,
    name,
    className: student.schoolClass.name,
    average,
  };
}

export async function promoteStudents(input: {
  session: string;
  term: Term;
  actorId: string;
  schoolId: string;
}) {
  if (input.term !== "THIRD") {
    throw new AppError(400, "Promotion runs only after the THIRD term");
  }

  const session = input.session.trim();
  const students = await prisma.student.findMany({
    where: { schoolId: input.schoolId },
    include: { schoolClass: true, user: { select: { id: true, fullName: true } } },
  });

  const promoted: Array<{ id: string; name: string; from: string; to: string }> = [];
  const repeating: Array<{ id: string; name: string; className: string; average: number }> = [];
  const skipped: Array<{ id: string; name: string; reason: string }> = [];

  for (const student of students) {
    const result = await applyPromoteOne(student, session, input.actorId, input.schoolId);
    if (result.type === "promoted") promoted.push(result);
    else if (result.type === "repeating") repeating.push(result);
    else skipped.push({ id: result.id, name: result.name, reason: result.reason });
  }

  return {
    session,
    term: input.term,
    passAverage: PASS_AVERAGE,
    promoted,
    repeating,
    skipped,
    summary: {
      promoted: promoted.length,
      repeating: repeating.length,
      skipped: skipped.length,
    },
    message: `Promotion complete: ${promoted.length} promoted, ${repeating.length} repeating, ${skipped.length} skipped.`,
  };
}

/** Selective promote/repeat — uses same PASS_AVERAGE / class ladder rules. */
export async function promoteSelectedStudents(input: {
  session: string;
  term: Term;
  actorId: string;
  schoolId: string;
  studentIds: string[];
  action: "promote" | "repeat" | "auto";
}) {
  if (input.term !== "THIRD") {
    throw new AppError(400, "Promotion runs only after the THIRD term");
  }
  if (!input.studentIds.length) throw new AppError(400, "Select at least one student");

  const session = input.session.trim();
  const students = await prisma.student.findMany({
    where: { schoolId: input.schoolId, id: { in: input.studentIds } },
    include: { schoolClass: true },
  });

  if (students.length !== input.studentIds.length) {
    throw new AppError(400, "One or more students were not found in this school");
  }

  const promoted: Array<{ id: string; name: string; from: string; to: string }> = [];
  const repeating: Array<{ id: string; name: string; className: string; average: number }> = [];
  const skipped: Array<{ id: string; name: string; reason: string }> = [];

  for (const student of students) {
    if (student.academicStatus === "PROMOTED" && input.action === "promote") {
      skipped.push({
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
        reason: "Already promoted — skipped to avoid duplicate promotion",
      });
      continue;
    }

    const force =
      input.action === "auto" ? undefined : input.action === "promote" ? "promote" : "repeat";
    const result = await applyPromoteOne(student, session, input.actorId, input.schoolId, force);
    if (result.type === "promoted") promoted.push(result);
    else if (result.type === "repeating") repeating.push(result);
    else skipped.push({ id: result.id, name: result.name, reason: result.reason });
  }

  return {
    session,
    term: input.term,
    passAverage: PASS_AVERAGE,
    promoted,
    repeating,
    skipped,
    summary: {
      promoted: promoted.length,
      repeating: repeating.length,
      skipped: skipped.length,
    },
    message: `Done: ${promoted.length} promoted, ${repeating.length} repeating, ${skipped.length} skipped.`,
  };
}
