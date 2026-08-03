// Purpose: Score entry — teachers only for subjects they teach; server computes grade.
import { AppError, assertFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { calculateGrade } from "../utils/grades.js";
import type { AuthUser } from "../middleware/auth.js";

async function assertTeacherCanScore(teacherId: string, subjectId: string, session: string) {
  const assignment = await prisma.teacherSubject.findFirst({
    where: { teacherId, subjectId, session },
  });

  if (!assignment) {
    throw new AppError(403, "You can only enter scores for subjects you teach in this session");
  }
}

export async function upsertScore(
  input: { enrollmentId: string; assessment: number; exam: number },
  actor: AuthUser
) {
  if (actor.role !== "TEACHER" || !actor.teacherId) {
    throw new AppError(403, "Only teachers can enter scores");
  }

  const enrollment = assertFound(
    await prisma.enrollment.findUnique({
      where: { id: input.enrollmentId },
      include: { score: true, subject: true },
    }),
    "Enrollment not found"
  );

  await assertTeacherCanScore(actor.teacherId, enrollment.subjectId, enrollment.session);

  let gradeResult;
  try {
    gradeResult = calculateGrade(input.assessment, input.exam);
  } catch (e) {
    throw new AppError(400, e instanceof Error ? e.message : "Invalid score");
  }

  const data = {
    teacherId: actor.teacherId,
    assessment: input.assessment,
    exam: input.exam,
    total: gradeResult.total,
    grade: gradeResult.grade,
    remark: gradeResult.remark,
  };

  if (enrollment.score) {
    return prisma.score.update({
      where: { id: enrollment.score.id },
      data,
      include: {
        enrollment: { include: { student: true, subject: true } },
        teacher: true,
      },
    });
  }

  return prisma.score.create({
    data: {
      enrollmentId: input.enrollmentId,
      ...data,
    },
    include: {
      enrollment: { include: { student: true, subject: true } },
      teacher: true,
    },
  });
}

export async function listScores(params: {
  actor: AuthUser;
  studentId?: string;
  subjectId?: string;
  session?: string;
  page: number;
  limit: number;
}) {
  const { actor } = params;

  if (actor.role === "STUDENT") {
    if (!actor.studentId) {
      throw new AppError(403, "Student profile not found");
    }
    params.studentId = actor.studentId;
  }

  let enrollmentFilter: {
    studentId?: string;
    subjectId?: string;
    session?: string;
    OR?: Array<{ subjectId: string; session: string }>;
  } = {
    studentId: params.studentId,
    subjectId: params.subjectId,
    session: params.session,
  };

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
    enrollmentFilter = {
      ...enrollmentFilter,
      OR: assignments.map((a) => ({ subjectId: a.subjectId, session: a.session })),
    };
  }

  const where = {
    enrollment: enrollmentFilter,
  };

  const [total, data] = await Promise.all([
    prisma.score.count({ where }),
    prisma.score.findMany({
      where,
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      orderBy: { updatedAt: "desc" },
      include: {
        enrollment: { include: { student: true, subject: true } },
        teacher: true,
      },
    }),
  ]);

  return {
    data,
    meta: { total, page: params.page, limit: params.limit, pages: Math.ceil(total / params.limit) },
  };
}

export async function getStudentResults(studentId: string, actor: AuthUser) {
  if (actor.role === "STUDENT" && actor.studentId !== studentId) {
    throw new AppError(403, "Students can only view their own results");
  }

  await assertFound(await prisma.student.findUnique({ where: { id: studentId } }), "Student not found");

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    include: {
      subject: true,
      score: { include: { teacher: true } },
    },
    orderBy: { session: "desc" },
  });

  const scored = enrollments.filter((e) => e.score);
  const average =
    scored.length > 0
      ? Number((scored.reduce((sum, e) => sum + (e.score?.total ?? 0), 0) / scored.length).toFixed(2))
      : null;

  return {
    enrollments: enrollments.map((e) => ({
      ...e,
      resultStatus: e.score ? "GRADED" : "AWAITING_RESULT",
      resultStatusLabel: e.score ? "Graded" : "Awaiting Result",
      caScore: e.score?.assessment ?? null,
      examScore: e.score?.exam ?? null,
    })),
    summary: {
      enrolled: enrollments.length,
      graded: scored.length,
      awaiting: enrollments.length - scored.length,
      average,
    },
  };
}

export async function deleteScore(id: string, actor: AuthUser) {
  const score = assertFound(
    await prisma.score.findUnique({
      where: { id },
      include: { enrollment: true },
    }),
    "Score not found"
  );

  if (actor.role === "TEACHER") {
    if (!actor.teacherId || score.teacherId !== actor.teacherId) {
      throw new AppError(403, "You can only delete scores you entered");
    }
    await assertTeacherCanScore(actor.teacherId, score.enrollment.subjectId, score.enrollment.session);
  } else if (actor.role !== "ADMIN") {
    throw new AppError(403, "Not allowed");
  }

  await prisma.score.delete({ where: { id } });
  return { message: "Score deleted" };
}
