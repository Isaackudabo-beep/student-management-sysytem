// Purpose: Enrollment HTTP routes — Admin registers students for subjects.
import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createEnrollmentSchema } from "../validators/schemas.js";
import * as enrollmentService from "../services/enrollment.service.js";
const listSchema = z.object({
    studentId: z.string().optional(),
    subjectId: z.string().optional(),
    session: z.string().optional(),
    term: z.enum(["FIRST", "SECOND", "THIRD"]).optional(),
    classId: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(500).default(20),
});
const router = Router();
router.use(authenticate);
router.get("/", authorize("ADMIN", "TEACHER"), validate(listSchema, "query"), async (req, res, next) => {
    try {
        const result = await enrollmentService.listEnrollments(req.query, req.user);
        res.json({ success: true, ...result });
    }
    catch (error) {
        next(error);
    }
});
router.post("/", authorize("ADMIN"), validate(createEnrollmentSchema), async (req, res, next) => {
    try {
        const enrollment = await enrollmentService.createEnrollment(req.body);
        res.status(201).json({ success: true, data: enrollment });
    }
    catch (error) {
        next(error);
    }
});
router.delete("/:id", authorize("ADMIN"), async (req, res, next) => {
    try {
        const result = await enrollmentService.deleteEnrollment(req.params.id);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
export default router;
