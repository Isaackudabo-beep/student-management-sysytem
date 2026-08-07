// Purpose: Promote / repeat students after Third Term using cumulative average ≥ 45%.
import type { Term } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { isTerminalLevel, nextLevel, PASS_AVERAGE } from "../utils/levels.js";
import * as announcementService from "./announcement.service.js";

export async function promoteStudents(input: {
  session: string;
  term: Term;
  actorId: string;
}) {
  if (input.term !== "THIRD") {
    throw new AppError(400, "Promotion runs only after the THIRD term");
  }

  const session = input.session.trim();
  const students = await prisma.student.findMany({
    include: { schoolClass: true, user: { select: { id: true, fullName: true } } },
  });

  const promoted: Array<{ id: string; name: string; from: string; to: string }> = [];
  const repeating: Array<{ id: string; name: string; className: string; average: number }> = [];
  const skipped: Array<{ id: string; name: string; reason: string }> = [];

  for (const student of students) {
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: student.id, session, term: "THIRD" },
      include: { score: true },
    });

    // Prefer live scores; fall back to archives if term was already closed.
    let totals = enrollments.filter((e) => e.score).map((e) => e.score!.total);
    if (totals.length === 0) {
      const archived = await prisma.resultArchive.findMany({
        where: { studentId: student.id, session, term: "THIRD" },
      });
      totals = archived.map((a) => a.total);
    }

    if (totals.length === 0) {
      skipped.push({
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
        reason: "No third-term scores found",
      });
      continue;
    }

    const average = Number((totals.reduce((s, t) => s + t, 0) / totals.length).toFixed(2));
    const name = `${student.firstName} ${student.lastName}`;

    if (average >= PASS_AVERAGE) {
      if (isTerminalLevel(student.level)) {
        await prisma.student.update({
          where: { id: student.id },
          data: { academicStatus: "PROMOTED" },
        });
        promoted.push({
          id: student.id,
          name,
          from: student.schoolClass.name,
          to: "Graduated (SS3)",
        });
        await announcementService.createSystemAnnouncement({
          title: "Congratulations — you completed SS3",
          body: `Your third-term average for ${session} was ${average}%. You have completed secondary school.`,
          audience: "USER",
          createdById: input.actorId,
          targetUserId: student.userId,
        });
        continue;
      }

      const nxt = nextLevel(student.level);
      if (!nxt) {
        skipped.push({ id: student.id, name, reason: "No next level mapping" });
        continue;
      }

      const nextClass = await prisma.schoolClass.findFirst({
        where: {
          level: { equals: nxt, mode: "insensitive" },
          ...(student.schoolClass.arm
            ? { arm: { equals: student.schoolClass.arm, mode: "insensitive" } }
            : {}),
        },
        orderBy: { name: "asc" },
      });

      if (!nextClass) {
        skipped.push({
          id: student.id,
          name,
          reason: `No class found for level ${nxt}${student.schoolClass.arm ? ` arm ${student.schoolClass.arm}` : ""}. Create it under Classes first.`,
        });
        continue;
      }

      await prisma.student.update({
        where: { id: student.id },
        data: {
          classId: nextClass.id,
          level: nextClass.level,
          academicStatus: "PROMOTED",
        },
      });

      promoted.push({
        id: student.id,
        name,
        from: student.schoolClass.name,
        to: nextClass.name,
      });

      await announcementService.createSystemAnnouncement({
        title: "You have been promoted",
        body: `Your third-term average for ${session} was ${average}% (≥ ${PASS_AVERAGE}%). You move from ${student.schoolClass.name} to ${nextClass.name}.`,
        audience: "USER",
        createdById: input.actorId,
        targetUserId: student.userId,
      });
    } else {
      await prisma.student.update({
        where: { id: student.id },
        data: { academicStatus: "REPEATING" },
      });
      repeating.push({
        id: student.id,
        name,
        className: student.schoolClass.name,
        average,
      });
      await announcementService.createSystemAnnouncement({
        title: "Class repeat notice",
        body: `Your third-term average for ${session} was ${average}% (below ${PASS_AVERAGE}%). You will repeat ${student.schoolClass.name}. Your portal shows “Repeated”.`,
        audience: "USER",
        createdById: input.actorId,
        targetUserId: student.userId,
      });
    }
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
