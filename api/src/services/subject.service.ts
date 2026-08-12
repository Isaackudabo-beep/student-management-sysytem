// Purpose: Subject CRUD — secondary school levels (JSS1, SS2, etc.).
import { Prisma } from "@prisma/client";
import { AppError, assertFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { assertSchoolMatch, requireSchoolId } from "../lib/schoolScope.js";
import type { AuthUser } from "../middleware/auth.js";

export async function createSubject(
  input: {
    code: string;
    title: string;
    unit: number;
    semester: number;
    level: string;
  },
  actor: AuthUser
) {
  const schoolId = requireSchoolId(actor);
  const code = input.code.toUpperCase();

  const existing = await prisma.subject.findUnique({
    where: { schoolId_code: { schoolId, code } },
  });
  if (existing) {
    throw new AppError(409, `Subject code ${code} already exists`);
  }

  return prisma.subject.create({
    data: {
      schoolId,
      ...input,
      code,
      level: input.level.toUpperCase(),
    },
  });
}

export async function listSubjects(
  params: {
    q?: string;
    level?: string;
    page: number;
    limit: number;
  },
  actor: AuthUser
) {
  const schoolId = requireSchoolId(actor);
  const where: Prisma.SubjectWhereInput = {
    AND: [
      { schoolId },
      params.level ? { level: { equals: params.level, mode: "insensitive" } } : {},
      params.q
        ? {
            OR: [
              { code: { contains: params.q, mode: "insensitive" } },
              { title: { contains: params.q, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };

  const [total, data] = await Promise.all([
    prisma.subject.count({ where }),
    prisma.subject.findMany({
      where,
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      orderBy: { code: "asc" },
      include: {
        teachers: { include: { teacher: true } },
        _count: { select: { enrollments: true } },
      },
    }),
  ]);

  return {
    data,
    meta: { total, page: params.page, limit: params.limit, pages: Math.ceil(total / params.limit) || 1 },
  };
}

export async function getSubjectById(id: string, actor: AuthUser) {
  const subject = assertFound(
    await prisma.subject.findUnique({
      where: { id },
      include: {
        teachers: { include: { teacher: true } },
        enrollments: { include: { student: true, score: true } },
      },
    }),
    "Subject not found"
  );
  assertSchoolMatch(actor, subject.schoolId, "Subject");
  return subject;
}

export async function updateSubject(
  id: string,
  input: Partial<{
    code: string;
    title: string;
    unit: number;
    semester: number;
    level: string;
  }>,
  actor: AuthUser
) {
  const subject = assertFound(await prisma.subject.findUnique({ where: { id } }), "Subject not found");
  assertSchoolMatch(actor, subject.schoolId, "Subject");

  if (input.code) {
    const code = input.code.toUpperCase();
    const clash = await prisma.subject.findUnique({
      where: { schoolId_code: { schoolId: subject.schoolId, code } },
    });
    if (clash && clash.id !== id) {
      throw new AppError(409, `Subject code ${code} already exists`);
    }
  }

  return prisma.subject.update({
    where: { id },
    data: {
      ...input,
      code: input.code ? input.code.toUpperCase() : undefined,
      level: input.level ? input.level.toUpperCase() : undefined,
    },
  });
}

export async function deleteSubject(id: string, actor: AuthUser) {
  const subject = assertFound(
    await prisma.subject.findUnique({
      where: { id },
      include: {
        enrollments: { include: { score: true } },
        teachers: true,
      },
    }),
    "Subject not found"
  );
  assertSchoolMatch(actor, subject.schoolId, "Subject");

  const hasScores = subject.enrollments.some((e) => e.score);
  if (hasScores) {
    throw new AppError(400, "A subject with existing scores cannot be deleted until those scores are removed.");
  }

  if (subject.enrollments.length > 0 || subject.teachers.length > 0) {
    throw new AppError(
      400,
      "Cannot delete subject with enrollments or teacher assignments. Remove related records first."
    );
  }

  await prisma.subject.delete({ where: { id } });
  return { message: "Subject deleted" };
}
