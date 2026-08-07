// Purpose: Enrollment create/list/delete — teacher lists scoped to assigned subjects.
import { Prisma } from "@prisma/client";
import { AppError, assertFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";

export async function createEnrollment(input: {
  studentId: string;
  subjectId: string;
  session: string;
  term?: "FIRST" | "SECOND" | "THIRD";
}) {
  const term = input.term ?? "FIRST";
  const student = assertFound(
    await prisma.student.findUnique({ where: { id: input.studentId } }),
    "Student not found"
  );
  const subject = assertFound(
    await prisma.subject.findUnique({ where: { id: input.subjectId } }),
    "Subject not found"
  );

  if (subject.level.toUpperCase() !== student.level.toUpperCase()) {
    throw new AppError(400, `Subject level ${subject.level} does not match student class level ${student.level}`);
  }

  const count = await prisma.enrollment.count({
    where: { studentId: input.studentId, session: input.session, term },
  });
  if (count >= 11) {
    throw new AppError(400, "A student cannot have more than 11 subjects in a term");
  }

  const existing = await prisma.enrollment.findUnique({
    where: {
      studentId_subjectId_session_term: {
        studentId: input.studentId,
        subjectId: input.subjectId,
        session: input.session,
        term,
      },
    },
  });
  if (existing) {
    throw new AppError(409, "This student is already enrolled in that subject for this session/term");
  }

  return prisma.enrollment.create({
    data: {
      studentId: input.studentId,
      subjectId: input.subjectId,
      session: input.session,
      term,
    },
    include: { student: true, subject: true },
  });
}

export async function listEnrollments(
  params: {
    studentId?: string;
    subjectId?: string;
    session?: string;
    term?: "FIRST" | "SECOND" | "THIRD";
    classId?: string;
    page: number;
    limit: number;
  },
  actor: AuthUser
) {
  let subjectFilter: Prisma.EnrollmentWhereInput = {};

  if (actor.role === "TEACHER") {
    if (!actor.teacherId) throw new AppError(403, "Teacher profile not found");
    const assignments = await prisma.teacherSubject.findMany({
      where: { teacherId: actor.teacherId, ...(params.session ? { session: params.session } : {}) },
    });
    if (assignments.length === 0) {
      return {
        data: [],
        meta: { total: 0, page: params.page, limit: params.limit, pages: 0 },
      };
    }
    subjectFilter = {
      OR: assignments.map((a) => ({ subjectId: a.subjectId, session: a.session })),
    };
  }

  if (actor.role === "STUDENT") {
    params.studentId = actor.studentId;
  }

  const where: Prisma.EnrollmentWhereInput = {
    AND: [
      subjectFilter,
      params.studentId ? { studentId: params.studentId } : {},
      params.subjectId ? { subjectId: params.subjectId } : {},
      params.session ? { session: params.session } : {},
      params.term ? { term: params.term } : {},
      params.classId ? { student: { classId: params.classId } } : {},
    ],
  };

  const [total, rows] = await Promise.all([
    prisma.enrollment.count({ where }),
    prisma.enrollment.findMany({
      where,
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      orderBy: { createdAt: "desc" },
      include: {
        student: { include: { schoolClass: true } },
        subject: true,
        score: true,
      },
    }),
  ]);

  const data = rows.map((e) => ({
    ...e,
    resultStatus: e.score ? "GRADED" : "AWAITING_RESULT",
    resultStatusLabel: e.score ? "Graded" : "Awaiting Result",
  }));

  return {
    data,
    meta: { total, page: params.page, limit: params.limit, pages: Math.ceil(total / params.limit) || 1 },
  };
}

export async function deleteEnrollment(id: string) {
  const enrollment = assertFound(
    await prisma.enrollment.findUnique({
      where: { id },
      include: { score: true },
    }),
    "Enrollment not found"
  );

  if (enrollment.score) {
    throw new AppError(400, "Cannot delete enrollment that has a score. Remove the score first.");
  }

  await prisma.enrollment.delete({ where: { id } });
  return { message: "Enrollment deleted" };
}
