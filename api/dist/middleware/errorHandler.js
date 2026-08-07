import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";
import { env } from "../config/env.js";
export function notFoundHandler(_req, _res, next) {
    next(new AppError(404, "Route not found"));
}
export function errorHandler(err, _req, res, _next) {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            code: err.code,
            details: err.details,
        });
    }
    if (err instanceof ZodError) {
        const flat = err.flatten();
        const failedFields = Object.keys(flat.fieldErrors).filter((key) => flat.fieldErrors[key]?.length);
        return res.status(400).json({
            success: false,
            message: failedFields.length > 0
                ? `Validation failed for: ${failedFields.join(", ")}`
                : "Validation failed",
            details: flat,
        });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002") {
            const target = err.meta?.target?.join(", ") ?? "field";
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
    if (err instanceof Prisma.PrismaClientInitializationError) {
        console.error(err);
        return res.status(503).json({
            success: false,
            message: "Database connection unavailable. Please retry shortly.",
        });
    }
    console.error(err);
    return res.status(500).json({
        success: false,
        message: env.NODE_ENV === "production" ? "Internal server error" : String(err),
    });
}
