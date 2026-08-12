// Purpose: Score entry — teachers only for subjects they teach; server computes grade.
import { AppError, assertFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { assertSchoolMatch, requireSchoolId } from "../lib/schoolScope.js";
import { calculateGrade } from "../utils/grades.js";
import type { AuthUser } from "../middleware/auth.js";
import {
  enrollmentBaseSelect,
  enrollmentSelectWithTerm,
  isSchemaMismatch,
  studentBaseSelect,
  studentSelectWithStatus,
  withAcademicStatus,
  withTerm,
} from "../lib/safeSelects.js";

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
  requireSchoolId(actor);
  if (actor.role !== "TEACHER" || !actor.teacherId) {
    throw new AppError(403, "Only teachers can enter scores");
  }

  const enrollment = assertFound(
    await prisma.enrollment.findUnique({
      where: { id: input.enrollmentId },
      include: { score: true, subject: true, student: true },
    }),
    "Enrollment not found"
  );
  assertSchoolMatch(actor, enrollment.student.schoolId, "Enrollment");

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
        enrollment: { include: { student: { include: { user: true } }, subject: true } },
        teacher: true,
      },
    }).then(async (score) => {
      await notifyScoreSaved(score, actor.id);
      return score;
    });
  }

  return prisma.score.create({
    data: {
      enrollmentId: input.enrollmentId,
      ...data,
    },
    include: {
      enrollment: { include: { student: { include: { user: true } }, subject: true } },
      teacher: true,
    },
  }).then(async (score) => {
    await notifyScoreSaved(score, actor.id);
    return score;
  });
}

async function notifyScoreSaved(
  score: {
    total: number;
    grade: string;
    enrollment: {
      student: { userId: string; firstName: string; lastName: string; schoolId: string };
      subject: { code: string; title: string };
      session: string;
      term: string;
    };
  },
  actorId: string
) {
  try {
    const { createSystemAnnouncement } = await import("./announcement.service.js");
    await createSystemAnnouncement({
      schoolId: score.enrollment.student.schoolId,
      title: `Result published — ${score.enrollment.subject.code}`,
      body: `Your score in ${score.enrollment.subject.title} (${score.enrollment.session}, ${score.enrollment.term ?? "FIRST"}) is ${score.total} (${score.grade}).`,
      audience: "USER",
      createdById: actorId,
      targetUserId: score.enrollment.student.userId,
    });
  } catch {
    // Non-blocking notification
  }
}

export async function listScores(params: {
  actor: AuthUser;
  studentId?: string;
  subjectId?: string;
  session?: string;
  term?: "FIRST" | "SECOND" | "THIRD";
  classId?: string;
  page: number;
  limit: number;
}) {
  const { actor } = params;
  const schoolId = requireSchoolId(actor);

  if (actor.role === "STUDENT") {
    if (!actor.studentId) {
      throw new AppError(403, "Student profile not found");
    }
    params.studentId = actor.studentId;
  }

  let assignmentOr: Array<{ subjectId: string; session: string }> | undefined;

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
    assignmentOr = assignments.map((a) => ({ subjectId: a.subjectId, session: a.session }));
  }

  function buildEnrollmentFilter(includeTerm: boolean) {
    const base: Record<string, unknown> = {
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

  async function fetch(
    includeTerm: boolean,
    enrollmentSelect: typeof enrollmentSelectWithTerm | typeof enrollmentBaseSelect,
    studentSelect: typeof studentSelectWithStatus | typeof studentBaseSelect
  ) {
    const enrollmentFilter = buildEnrollmentFilter(includeTerm);
    const where = { enrollment: enrollmentFilter };

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

    const data = rows.map((row) => ({
      ...row,
      enrollment: withTerm({
        ...row.enrollment,
        student: withAcademicStatus(row.enrollment.student),
      }),
    }));

    return {
      data,
      meta: { total, page: params.page, limit: params.limit, pages: Math.ceil(total / params.limit) || 1 },
    };
  }

  try {
    return await fetch(true, enrollmentSelectWithTerm, studentSelectWithStatus);
  } catch (err) {
    if (!isSchemaMismatch(err)) throw err;
    return fetch(false, enrollmentBaseSelect, studentBaseSelect);
  }
}

export async function getStudentResults(studentId: string, actor: AuthUser) {
  const schoolId = requireSchoolId(actor);
  if (actor.role === "STUDENT" && actor.studentId !== studentId) {
    throw new AppError(403, "Students can only view their own results");
  }

  let student;
  try {
    student = assertFound(
      await prisma.student.findFirst({
        where: { id: studentId, schoolId },
        select: {
          ...studentSelectWithStatus,
          schoolClass: true,
          user: { select: { fullName: true } },
        },
      }),
      "Student not found"
    );
  } catch (err) {
    if (!isSchemaMismatch(err)) throw err;
    student = assertFound(
      await prisma.student.findFirst({
        where: { id: studentId, schoolId },
        select: {
          ...studentBaseSelect,
          schoolClass: true,
          user: { select: { fullName: true } },
        },
      }),
      "Student not found"
    );
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
  } catch (err) {
    if (!isSchemaMismatch(err)) throw err;
    enrollments = await prisma.enrollment.findMany({
      where: { studentId, student: { schoolId } },
      include: {
        subject: true,
        score: { include: { teacher: true } },
      },
      orderBy: [{ session: "desc" }, { createdAt: "asc" }],
    });
  }

  let archived: Awaited<ReturnType<typeof prisma.resultArchive.findMany>> = [];
  try {
    archived = await prisma.resultArchive.findMany({
      where: { studentId, student: { schoolId } },
      orderBy: [{ session: "desc" }, { term: "asc" }, { archivedAt: "desc" }],
    });
  } catch {
    archived = [];
  }

  const scored = enrollments.filter((e) => e.score);
  const average =
    scored.length > 0
      ? Number((scored.reduce((sum, e) => sum + (e.score?.total ?? 0), 0) / scored.length).toFixed(2))
      : null;

  const sessions = [...new Set([...enrollments.map((e) => e.session), ...archived.map((a) => a.session)])];

  const classDisplay =
    student.academicStatus === "REPEATING"
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
      academicStatusLabel:
        student.academicStatus === "REPEATING"
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
      return {
        ...row,
        resultStatus: e.score ? "GRADED" : "AWAITING_RESULT",
        resultStatusLabel: e.score ? "Graded" : "Awaiting Result",
        caScore: e.score?.assessment ?? null,
        examScore: e.score?.exam ?? null,
      };
    }),
    archivedResults: archived,
    summary: {
      enrolled: enrollments.length,
      graded: scored.length,
      awaiting: enrollments.length - scored.length,
      average,
    },
  };
}

export async function deleteScore(id: string, actor: AuthUser) {
  requireSchoolId(actor);
  const score = assertFound(
    await prisma.score.findUnique({
      where: { id },
      include: { enrollment: { include: { student: true } } },
    }),
    "Score not found"
  );
  assertSchoolMatch(actor, score.enrollment.student.schoolId, "Score");

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
