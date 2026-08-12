// Purpose: Auth service — role-gated login, password change/reset, profile.
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { signToken } from "../utils/jwt.js";

function publicUser(user: {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
  schoolId?: string | null;
  student?: { id: string } | null;
  teacher?: { id: string } | null;
}) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    schoolId: user.schoolId ?? null,
    studentId: user.student?.id ?? null,
    teacherId: user.teacher?.id ?? null,
  };
}

export async function login(email: string, password: string, expectedRole: Role) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      student: { select: { id: true } },
      teacher: { select: { id: true } },
      school: { select: { id: true, status: true, name: true } },
    },
  });

  if (!user) {
    throw new AppError(401, "Invalid email or password");
  }

  let valid = false;
  try {
    valid = await bcrypt.compare(password, user.passwordHash);
  } catch {
    throw new AppError(401, "Invalid email or password");
  }
  if (!valid) {
    throw new AppError(401, "Invalid email or password");
  }

  if (user.role !== expectedRole) {
    throw new AppError(403, `This portal is for ${expectedRole.toLowerCase().replace("_", " ")}s only`);
  }

  if (user.role === "SUPER_ADMIN") {
    // Platform admins are not tied to a school workspace.
  } else {
    if (!user.schoolId || !user.school) {
      throw new AppError(403, "Your account is not linked to a school");
    }
    if (user.school.status === "SUSPENDED") {
      throw new AppError(403, "This school is suspended. Contact the platform administrator.");
    }
  }

  const token = signToken({
    sub: user.id,
    role: user.role,
    email: user.email,
    schoolId: user.schoolId,
  });

  return {
    token,
    user: publicUser(user),
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      student: { select: { id: true } },
      teacher: { select: { id: true } },
      school: { select: { id: true, name: true, status: true, code: true } },
    },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  return {
    ...publicUser(user),
    student: user.student,
    teacher: user.teacher,
    school: user.school,
  };
}

export async function changePassword(
  userId: string,
  input: { currentPassword?: string; newPassword: string }
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, "User not found");

  if (!user.mustChangePassword) {
    if (!input.currentPassword) {
      throw new AppError(400, "Current password is required");
    }
    const ok = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!ok) throw new AppError(400, "Current password is incorrect");
  } else if (input.currentPassword) {
    const ok = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!ok) throw new AppError(400, "Current password is incorrect");
  }

  const passwordHash = await bcrypt.hash(input.newPassword, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  });

  return { message: "Password updated" };
}

export async function adminResetPassword(
  actorSchoolId: string,
  userId: string,
  temporaryPassword: string
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, "User not found");
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
    throw new AppError(400, "Admin passwords cannot be reset through this endpoint");
  }
  if (user.schoolId !== actorSchoolId) {
    throw new AppError(404, "User not found");
  }

  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: true },
  });

  return {
    message: "Temporary password set. User must change it on next login.",
    userId: user.id,
    email: user.email,
  };
}

export async function forgotPassword(email: string) {
  await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  return {
    message:
      "If an account exists for that email, a reset link will be sent when email delivery is configured. Ask an administrator to reset your password for now.",
    emailConfigured: false,
  };
}
