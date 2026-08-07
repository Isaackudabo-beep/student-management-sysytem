// Purpose: Attach authenticated user to req; enforce role and forced password change.
import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { verifyToken } from "../utils/jwt.js";

export type AuthUser = {
  id: string;
  email: string;
  role: Role;
  fullName: string;
  mustChangePassword: boolean;
  studentId?: string;
  teacherId?: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const PASSWORD_CHANGE_ALLOWLIST = new Set([
  "GET /api/auth/me",
  "POST /api/auth/change-password",
]);

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AppError(401, "Authentication required");
    }

    const token = header.slice(7);
    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        student: { select: { id: true } },
        teacher: { select: { id: true } },
      },
    });

    if (!user) {
      throw new AppError(401, "Invalid token");
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      mustChangePassword: user.mustChangePassword,
      studentId: user.student?.id,
      teacherId: user.teacher?.id,
    };

    if (user.mustChangePassword) {
      const key = `${req.method} ${req.baseUrl}${req.path}`.replace(/\/$/, "") || `${req.method} ${req.originalUrl.split("?")[0]}`;
      const normalized = `${req.method} ${req.baseUrl}${req.route?.path === "/" ? "" : (req.route?.path ?? req.path)}`;
      const candidates = [
        `${req.method} ${req.originalUrl.split("?")[0]}`,
        key,
        normalized,
        `GET /api/auth/me`,
        `POST /api/auth/change-password`,
      ];
      const allowed = candidates.some((c) => PASSWORD_CHANGE_ALLOWLIST.has(c));
      // Fallback: path ends with /me or /change-password under /api/auth
      const isAuthAllowed =
        req.baseUrl === "/api/auth" &&
        (req.path === "/me" || req.path === "/change-password");
      if (!allowed && !isAuthAllowed) {
        throw new AppError(
          403,
          "You must change your password before continuing",
          undefined,
          "PASSWORD_CHANGE_REQUIRED"
        );
      }
    }

    next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    return next(new AppError(401, "Invalid or expired token"));
  }
}

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, "Authentication required"));
    }
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          403,
          `This action requires ${roles.join(" or ")} access (you are signed in as ${req.user.role}). Sign in through the Admin portal if you need to manage the school.`
        )
      );
    }
    next();
  };
}
