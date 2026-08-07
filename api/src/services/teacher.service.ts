// Purpose: Teacher CRUD + multi-subject assignment + unassigned subjects.
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { AppError, assertFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

export async function createTeacher(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  department: string;
}) {
  const email = input.email.toLowerCase();
  const passwordHash = await bcrypt.hash(input.password, 12);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        fullName: `${input.firstName} ${input.lastName}`,
        email,
        passwordHash,
        role: "TEACHER",
      },
    });

    return tx.teacher.create({
      data: {
        userId: user.id,
        firstName: input.firstName,
        lastName: input.lastName,
        email,
        phone: input.phone,
        department: input.department,
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, role: true } },
        subjects: { include: { subject: true } },
      },
    });
  });
}

export async function updateTeacher(
  id: string,
  input: Partial<{
    firstName: string;
    lastName: string;
    phone: string | null;
    department: string;
    email: string;
  }>
) {
  const teacher = assertFound(
    await prisma.teacher.findUnique({ where: { id } }),
    "Teacher not found"
  );

  const email = input.email?.toLowerCase();
  const firstName = input.firstName ?? teacher.firstName;
  const lastName = input.lastName ?? teacher.lastName;

  return prisma.$transaction(async (tx) => {
    if (email || input.firstName || input.lastName) {
      await tx.user.update({
        where: { id: teacher.userId },
        data: {
          ...(email ? { email } : {}),
          fullName: `${firstName} ${lastName}`,
        },
      });
    }

    return tx.teacher.update({
      where: { id },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone === undefined ? undefined : input.phone,
        department: input.department,
        email,
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, role: true } },
        subjects: { include: { subject: true } },
      },
    });
  });
}

export async function listTeachers(params: { q?: string; page: number; limit: number }) {
  const where: Prisma.TeacherWhereInput = params.q
    ? {
        OR: [
          { firstName: { contains: params.q, mode: "insensitive" } },
          { lastName: { contains: params.q, mode: "insensitive" } },
          { email: { contains: params.q, mode: "insensitive" } },
          { department: { contains: params.q, mode: "insensitive" } },
        ],
      }
    : {};

  const [total, data] = await Promise.all([
    prisma.teacher.count({ where }),
    prisma.teacher.findMany({
      where,
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, fullName: true, role: true, mustChangePassword: true } },
        subjects: { include: { subject: true } },
      },
    }),
  ]);

  return {
    data: data.map((t) => ({
      ...t,
      avatarInitials: `${t.firstName[0] ?? ""}${t.lastName[0] ?? ""}`.toUpperCase(),
    })),
    meta: { total, page: params.page, limit: params.limit, pages: Math.ceil(total / params.limit) || 1 },
  };
}

export async function getTeacherById(id: string) {
  const teacher = assertFound(
    await prisma.teacher.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, fullName: true, email: true, role: true } },
        subjects: { include: { subject: true } },
      },
    }),
    "Teacher not found"
  );
  return {
    ...teacher,
    avatarInitials: `${teacher.firstName[0] ?? ""}${teacher.lastName[0] ?? ""}`.toUpperCase(),
  };
}

export async function assignTeacherToSubject(input: {
  teacherId: string;
  subjectId: string;
  session: string;
}) {
  await assertFound(await prisma.teacher.findUnique({ where: { id: input.teacherId } }), "Teacher not found");
  await assertFound(await prisma.subject.findUnique({ where: { id: input.subjectId } }), "Subject not found");

  return prisma.teacherSubject.upsert({
    where: {
      teacherId_subjectId_session: {
        teacherId: input.teacherId,
        subjectId: input.subjectId,
        session: input.session,
      },
    },
    create: input,
    update: {},
    include: { teacher: true, subject: true },
  });
}

export async function assignTeacherSubjects(input: {
  teacherId: string;
  subjectIds: string[];
  session: string;
}) {
  await assertFound(await prisma.teacher.findUnique({ where: { id: input.teacherId } }), "Teacher not found");
  const subjects = await prisma.subject.findMany({ where: { id: { in: input.subjectIds } } });
  if (subjects.length !== input.subjectIds.length) {
    throw new AppError(400, "One or more subjects were not found");
  }

  const created = await prisma.$transaction(
    input.subjectIds.map((subjectId) =>
      prisma.teacherSubject.upsert({
        where: {
          teacherId_subjectId_session: {
            teacherId: input.teacherId,
            subjectId,
            session: input.session,
          },
        },
        create: { teacherId: input.teacherId, subjectId, session: input.session },
        update: {},
        include: { subject: true },
      })
    )
  );

  return created;
}

export async function removeTeacherSubject(assignmentId: string) {
  await assertFound(
    await prisma.teacherSubject.findUnique({ where: { id: assignmentId } }),
    "Assignment not found"
  );
  await prisma.teacherSubject.delete({ where: { id: assignmentId } });
  return { message: "Subject removed from teacher" };
}

/** Subjects with no teacher assignment for the given session. */
export async function listUnassignedSubjects(session: string) {
  const assigned = await prisma.teacherSubject.findMany({
    where: { session },
    select: { subjectId: true },
  });
  const assignedIds = [...new Set(assigned.map((a) => a.subjectId))];

  return prisma.subject.findMany({
    where: assignedIds.length ? { id: { notIn: assignedIds } } : {},
    orderBy: [{ level: "asc" }, { code: "asc" }],
  });
}

export async function deleteTeacher(id: string) {
  const teacher = assertFound(
    await prisma.teacher.findUnique({
      where: { id },
      include: { subjects: true, scores: true },
    }),
    "Teacher not found"
  );

  if (teacher.scores.length > 0) {
    throw new AppError(
      400,
      "Cannot delete teacher who has entered scores. Reassign or keep the record for history."
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.teacherSubject.deleteMany({ where: { teacherId: id } });
    await tx.user.delete({ where: { id: teacher.userId } });
  });

  return { message: "Teacher deleted" };
}
