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
  student?: { id: string } | null;
  teacher?: { id: string } | null;
}) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    studentId: user.student?.id ?? null,
    teacherId: user.teacher?.id ?? null,
  };
}

export async function login(email: string, password: string, expectedRole: Role) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { student: true, teacher: true },
  });

  if (!user) {
    throw new AppError(401, "Invalid email or password");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, "Invalid email or password");
  }

  if (user.role !== expectedRole) {
    throw new AppError(403, `This portal is for ${expectedRole.toLowerCase()}s only`);
  }

  const token = signToken({
    sub: user.id,
    role: user.role,
    email: user.email,
  });

  return {
    token,
    user: publicUser(user),
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { student: true, teacher: true },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  return {
    ...publicUser(user),
    student: user.student,
    teacher: user.teacher,
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

export async function adminResetPassword(userId: string, temporaryPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, "User not found");
  if (user.role === "ADMIN") {
    throw new AppError(400, "Admin passwords cannot be reset through this endpoint");
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
  // Stub for future SMTP/Resend integration — do not reveal whether email exists.
  await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  return {
    message:
      "If an account exists for that email, a reset link will be sent when email delivery is configured. Ask an administrator to reset your password for now.",
    emailConfigured: false,
  };
}
