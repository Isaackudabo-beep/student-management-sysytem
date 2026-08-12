// Purpose: Platform SUPER_ADMIN — schools CRUD, stats, school admin management.
import bcrypt from "bcryptjs";
import type { Prisma, SchoolStatus } from "@prisma/client";
import { ensureDefaultClassesForSchool } from "../lib/defaultClasses.js";
import { AppError, assertFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

function slugCode(input: string) {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32);
}

export async function platformOverview() {
  const [schools, activeSchools, suspendedSchools, students, teachers, admins] = await Promise.all([
    prisma.school.count(),
    prisma.school.count({ where: { status: "ACTIVE" } }),
    prisma.school.count({ where: { status: "SUSPENDED" } }),
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
  ]);

  return {
    totalSchools: schools,
    activeSchools,
    suspendedSchools,
    totalStudents: students,
    totalTeachers: teachers,
    totalSchoolAdmins: admins,
  };
}

export async function listSchools(params: {
  q?: string;
  status?: SchoolStatus;
  page: number;
  limit: number;
}) {
  const where: Prisma.SchoolWhereInput = {
    AND: [
      params.status ? { status: params.status } : {},
      params.q
        ? {
            OR: [
              { name: { contains: params.q, mode: "insensitive" } },
              { code: { contains: params.q, mode: "insensitive" } },
              { email: { contains: params.q, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };

  const [total, rows] = await Promise.all([
    prisma.school.count({ where }),
    prisma.school.findMany({
      where,
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            students: true,
            teachers: true,
            classes: true,
            subjects: true,
            users: true,
          },
        },
      },
    }),
  ]);

  const data = await Promise.all(
    rows.map(async (school) => {
      const adminCount = await prisma.user.count({
        where: { schoolId: school.id, role: "ADMIN" },
      });
      return { ...school, adminCount };
    })
  );

  return {
    data,
    meta: { total, page: params.page, limit: params.limit, pages: Math.ceil(total / params.limit) || 1 },
  };
}

export async function getSchool(id: string) {
  const school = assertFound(
    await prisma.school.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            students: true,
            teachers: true,
            classes: true,
            subjects: true,
            announcements: true,
          },
        },
      },
    }),
    "School not found"
  );

  const admins = await prisma.user.findMany({
    where: { schoolId: id, role: "ADMIN" },
    select: {
      id: true,
      fullName: true,
      email: true,
      mustChangePassword: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return { ...school, admins };
}

export async function createSchool(input: {
  name: string;
  code?: string;
  address?: string;
  phone?: string;
  email?: string;
  admin?: {
    fullName: string;
    email: string;
    password: string;
  };
}) {
  const code = slugCode(input.code || input.name);
  if (!code) throw new AppError(400, "School code is required");

  const existing = await prisma.school.findUnique({ where: { code } });
  if (existing) throw new AppError(409, `School code ${code} already exists`);

  if (input.admin) {
    const email = input.admin.email.toLowerCase();
    // Email may exist in another school — only block within the new school after create.
    // Pre-check platform SUPER_ADMIN collision only.
    const platformClash = await prisma.user.findFirst({
      where: { email, schoolId: null },
    });
    if (platformClash) throw new AppError(409, "Admin email is already in use on the platform");
  }

  return prisma.$transaction(async (tx) => {
    const school = await tx.school.create({
      data: {
        name: input.name.trim(),
        code,
        address: input.address?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim().toLowerCase() || null,
        status: "ACTIVE",
      },
    });

    await ensureDefaultClassesForSchool(school.id, tx);

    let admin = null;
    if (input.admin) {
      const passwordHash = await bcrypt.hash(input.admin.password, 12);
      admin = await tx.user.create({
        data: {
          fullName: input.admin.fullName.trim(),
          email: input.admin.email.toLowerCase(),
          passwordHash,
          role: "ADMIN",
          schoolId: school.id,
          mustChangePassword: true,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          schoolId: true,
          mustChangePassword: true,
        },
      });
    }

    return { school, admin };
  });
}

export async function updateSchool(
  id: string,
  input: Partial<{
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    status: SchoolStatus;
  }>
) {
  assertFound(await prisma.school.findUnique({ where: { id } }), "School not found");

  return prisma.school.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      address: input.address === undefined ? undefined : input.address,
      phone: input.phone === undefined ? undefined : input.phone,
      email: input.email === undefined ? undefined : input.email?.toLowerCase() ?? null,
      status: input.status,
    },
  });
}

export async function setSchoolStatus(id: string, status: SchoolStatus) {
  assertFound(await prisma.school.findUnique({ where: { id } }), "School not found");
  return prisma.school.update({
    where: { id },
    data: { status },
  });
}

export async function createSchoolAdmin(
  schoolId: string,
  input: { fullName: string; email: string; password: string }
) {
  assertFound(await prisma.school.findUnique({ where: { id: schoolId } }), "School not found");

  const email = input.email.toLowerCase();
  const taken = await prisma.user.findFirst({
    where: { email, schoolId },
  });
  if (taken) throw new AppError(409, "Email is already in use at this school");

  const passwordHash = await bcrypt.hash(input.password, 12);
  return prisma.user.create({
    data: {
      fullName: input.fullName.trim(),
      email,
      passwordHash,
      role: "ADMIN",
      schoolId,
      mustChangePassword: true,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      schoolId: true,
      mustChangePassword: true,
      createdAt: true,
    },
  });
}

export async function listSchoolAdmins(schoolId: string) {
  assertFound(await prisma.school.findUnique({ where: { id: schoolId } }), "School not found");
  return prisma.user.findMany({
    where: { schoolId, role: "ADMIN" },
    select: {
      id: true,
      fullName: true,
      email: true,
      mustChangePassword: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
}
