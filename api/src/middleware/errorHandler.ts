// Purpose: Central error handler — turns AppError/Zod/Prisma errors into JSON responses.
import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";
import { env } from "../config/env.js";

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, "Route not found"));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
      details: err.details,
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      details: err.flatten(),
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = (err.meta?.target as string[] | undefined)?.join(", ") ?? "field";
      return res.status(409).json({
        success: false,
        message: `A record with this ${target} already exists`,
      });
    }
    if (err.code === "P2003") {
      return res.status(400).json({
        success: false,
        message: "Related record not found or cannot be modified due to existing relations",
      });
    }
    if (err.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Record not found",
      });
    }
  }

  console.error(err);

  return res.status(500).json({
    success: false,
    message: env.NODE_ENV === "production" ? "Internal server error" : String(err),
  });
}
