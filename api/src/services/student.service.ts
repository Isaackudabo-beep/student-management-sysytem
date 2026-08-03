// Purpose: Student CRUD — creates User + Student + 5–11 subject enrollments in one transaction.
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { AppError, assertFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

type CreateStudentInput = {
  email: string;
  password: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  phone: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  dateOfBirth: string;
  address: string;
  parentName: string;
  parentPhone: string;
  department?: string;
  classId: string;
  session: string;
  subjectIds: string[];
  fullName?: string;
};

export async function createStudent(input: CreateStudentInput) {
  if (input.subjectIds.length < 5 || input.subjectIds.length > 11) {
    throw new AppError(400, "Select between 5 and 11 subjects");
  }

  const uniqueSubjectIds = [...new Set(input.subjectIds)];
  if (uniqueSubjectIds.length !== input.subjectIds.length) {
    throw new AppError(400, "Duplicate subjects are not allowed");
  }

  const schoolClass = assertFound(
    await prisma.schoolClass.findUnique({ where: { id: input.classId } }),
    "Class not found"
  );

  const subjects = await prisma.subject.findMany({
    where: { id: { in: uniqueSubjectIds } },
  });

  if (subjects.length !== uniqueSubjectIds.length) {
    throw new AppError(400, "One or more selected subjects were not found");
  }

  const mismatched = subjects.filter(
    (s) => s.level.toUpperCase() !== schoolClass.level.toUpperCase()
  );
  if (mismatched.length > 0) {
    throw new AppError(
      400,
      `Subjects must match class level ${schoolClass.level}: ${mismatched.map((s) => s.code).join(", ")}`
    );
  }

  const email = input.email.toLowerCase();
  const fullName = input.fullName ?? `${input.firstName} ${input.lastName}`;
  const passwordHash = await bcrypt.hash(input.password, 12);
  const admissionNumber = input.admissionNumber.trim().toUpperCase();

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        role: "STUDENT",
        mustChangePassword: true,
      },
    });

    const student = await tx.student.create({
      data: {
        userId: user.id,
        admissionNumber,
        matricNumber: admissionNumber,
        firstName: input.firstName,
        lastName: input.lastName,
        email,
        phone: input.phone,
        gender: input.gender,
        dateOfBirth: new Date(input.dateOfBirth),
        address: input.address,
        parentName: input.parentName,
        parentPhone: input.parentPhone,
        department: input.department ?? "General",
        level: schoolClass.level,
        classId: schoolClass.id,
      },
    });

    await tx.enrollment.createMany({
      data: uniqueSubjectIds.map((subjectId) => ({
        studentId: student.id,
        subjectId,
        session: input.session,
      })),
    });

    return tx.student.findUnique({
      where: { id: student.id },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, role: true, mustChangePassword: true },
        },
        schoolClass: true,
        enrollments: { include: { subject: true, score: true } },
      },
    });
  });
}

export async function listStudents(params: {
  q?: string;
  department?: string;
  level?: string;
  classId?: string;
  page: number;
  limit: number;
}) {
  const where: Prisma.StudentWhereInput = {
    AND: [
      params.department ? { department: { contains: params.department, mode: "insensitive" } } : {},
      params.level ? { level: { equals: params.level, mode: "insensitive" } } : {},
      params.classId ? { classId: params.classId } : {},
      params.q
        ? {
            OR: [
              { firstName: { contains: params.q, mode: "insensitive" } },
              { lastName: { contains: params.q, mode: "insensitive" } },
              { email: { contains: params.q, mode: "insensitive" } },
              { admissionNumber: { contains: params.q, mode: "insensitive" } },
              { matricNumber: { contains: params.q, mode: "insensitive" } },
              { parentName: { contains: params.q, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };

  const [total, data] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, fullName: true, role: true, mustChangePassword: true } },
        schoolClass: true,
        _count: { select: { enrollments: true } },
      },
    }),
  ]);

  return {
    data,
    meta: { total, page: params.page, limit: params.limit, pages: Math.ceil(total / params.limit) || 1 },
  };
}

export async function getStudentById(id: string) {
  return assertFound(
    await prisma.student.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, role: true, mustChangePassword: true },
        },
        schoolClass: true,
        enrollments: { include: { subject: true, score: true } },
      },
    }),
    "Student not found"
  );
}

export async function updateStudent(
  id: string,
  input: Partial<{
    firstName: string;
    lastName: string;
    phone: string;
    gender: "MALE" | "FEMALE" | "OTHER";
    dateOfBirth: string;
    address: string;
    parentName: string;
    parentPhone: string;
    department: string;
    classId: string;
    fullName: string;
  }>
) {
  await assertFound(await prisma.student.findUnique({ where: { id } }), "Student not found");

  let level: string | undefined;
  if (input.classId) {
    const schoolClass = assertFound(
      await prisma.schoolClass.findUnique({ where: { id: input.classId } }),
      "Class not found"
    );
    level = schoolClass.level;
  }

  return prisma.$transaction(async (tx) => {
    const student = await tx.student.update({
      where: { id },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        gender: input.gender,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
        address: input.address,
        parentName: input.parentName,
        parentPhone: input.parentPhone,
        department: input.department,
        classId: input.classId,
        level,
      },
    });

    if (input.fullName || input.firstName || input.lastName) {
      await tx.user.update({
        where: { id: student.userId },
        data: {
          fullName:
            input.fullName ??
            `${input.firstName ?? student.firstName} ${input.lastName ?? student.lastName}`,
        },
      });
    }

    return tx.student.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, fullName: true, email: true, role: true } },
        schoolClass: true,
      },
    });
  });
}

export async function deleteStudent(id: string) {
  const student = assertFound(
    await prisma.student.findUnique({
      where: { id },
      include: { enrollments: { include: { score: true } } },
    }),
    "Student not found"
  );

  const hasScores = student.enrollments.some((e) => e.score);
  if (hasScores || student.enrollments.length > 0) {
    throw new AppError(
      400,
      "Cannot delete student with enrollments or scores. Remove related records first."
    );
  }

  await prisma.user.delete({ where: { id: student.userId } });
  return { message: "Student deleted" };
}
