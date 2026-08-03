// Purpose: Zod request validation middleware factory for body/query/params.
import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

type Target = "body" | "query" | "params";

export function validate(schema: ZodSchema, target: Target = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.parse(req[target]);
    req[target] = parsed;
    next();
  };
}
