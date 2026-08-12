// Purpose: Auth service — role-gated login, password change/reset, profile.
import bcrypt from "bcryptjs";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { signToken } from "../utils/jwt.js";
function publicUser(user) {
    return {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        schoolId: user.schoolId ?? null,
        schoolName: user.school?.name ?? null,
        schoolCode: user.school?.code ?? null,
        studentId: user.student?.id ?? null,
        teacherId: user.teacher?.id ?? null,
    };
}
export async function login(email, password, expectedRole, schoolCode) {
    const normalizedEmail = email.toLowerCase().trim();
    const code = schoolCode?.trim().toUpperCase();
    const candidates = await prisma.user.findMany({
        where: {
            email: normalizedEmail,
            role: expectedRole,
            ...(expectedRole === "SUPER_ADMIN"
                ? { schoolId: null }
                : code
                    ? { school: { code: { equals: code, mode: "insensitive" } } }
                    : {}),
        },
        include: {
            student: { select: { id: true } },
            teacher: { select: { id: true } },
            school: { select: { id: true, status: true, name: true, code: true } },
        },
        take: 10,
    });
    if (candidates.length === 0) {
        throw new AppError(401, "Invalid email or password");
    }
    if (expectedRole !== "SUPER_ADMIN" && !code && candidates.length > 1) {
        throw new AppError(400, "This email exists in more than one school. Enter your school code to continue.", { requiresSchoolCode: true, schools: candidates.map((c) => c.school?.code).filter(Boolean) }, "SCHOOL_CODE_REQUIRED");
    }
    // Prefer exact school match when code provided; otherwise the sole candidate.
    let user = candidates[0];
    if (code && candidates.length > 1) {
        const matched = candidates.find((c) => c.school?.code?.toUpperCase() === code);
        if (!matched)
            throw new AppError(401, "Invalid email or password");
        user = matched;
    }
    let valid = false;
    try {
        valid = await bcrypt.compare(password, user.passwordHash);
    }
    catch {
        throw new AppError(401, "Invalid email or password");
    }
    if (!valid) {
        throw new AppError(401, "Invalid email or password");
    }
    if (user.role === "SUPER_ADMIN") {
        // Platform admins are not tied to a school workspace.
    }
    else {
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
export async function getMe(userId) {
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
        school: user.school
            ? { id: user.school.id, name: user.school.name, code: user.school.code, status: user.school.status }
            : null,
    };
}
export async function changePassword(userId, input) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new AppError(404, "User not found");
    if (!user.mustChangePassword) {
        if (!input.currentPassword) {
            throw new AppError(400, "Current password is required");
        }
        const ok = await bcrypt.compare(input.currentPassword, user.passwordHash);
        if (!ok)
            throw new AppError(400, "Current password is incorrect");
    }
    else if (input.currentPassword) {
        const ok = await bcrypt.compare(input.currentPassword, user.passwordHash);
        if (!ok)
            throw new AppError(400, "Current password is incorrect");
    }
    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    await prisma.user.update({
        where: { id: userId },
        data: { passwordHash, mustChangePassword: false },
    });
    return { message: "Password updated" };
}
export async function adminResetPassword(actorSchoolId, userId, temporaryPassword) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new AppError(404, "User not found");
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
export async function forgotPassword(email) {
    await prisma.user.findFirst({ where: { email: email.toLowerCase() } });
    return {
        message: "If an account exists for that email, a reset link will be sent when email delivery is configured. Ask an administrator to reset your password for now.",
        emailConfigured: false,
    };
}
