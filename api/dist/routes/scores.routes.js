// Purpose: Score and results HTTP routes with role-based access.
import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { upsertScoreSchema } from "../validators/schemas.js";
import * as scoreService from "../services/score.service.js";
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
router.get("/", validate(listSchema, "query"), async (req, res, next) => {
    try {
        const result = await scoreService.listScores({
            actor: req.user,
            ...req.query,
        });
        res.json({ success: true, ...result });
    }
    catch (error) {
        next(error);
    }
});
router.get("/results/:studentId", async (req, res, next) => {
    try {
        const results = await scoreService.getStudentResults(req.params.studentId, req.user);
        res.json({ success: true, data: results });
    }
    catch (error) {
        next(error);
    }
});
router.post("/", authorize("TEACHER"), validate(upsertScoreSchema), async (req, res, next) => {
    try {
        const score = await scoreService.upsertScore(req.body, req.user);
        res.status(201).json({ success: true, data: score });
    }
    catch (error) {
        next(error);
    }
});
router.delete("/:id", authorize("ADMIN", "TEACHER"), async (req, res, next) => {
    try {
        const result = await scoreService.deleteScore(req.params.id, req.user);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
export default router;
