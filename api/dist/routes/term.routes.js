// Purpose: Admin term/session routes — list, close (archive), promote students.
import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { closeTermSchema, promoteStudentsSchema } from "../validators/schemas.js";
import * as termService from "../services/term.service.js";
import * as promoteService from "../services/promote.service.js";
const router = Router();
router.use(authenticate);
router.use(authorize("ADMIN"));
const previewSchema = z.object({
    session: z.string().min(4),
    term: z.enum(["FIRST", "SECOND", "THIRD"]).default("THIRD"),
    classId: z.string().optional(),
});
const promoteSelectedSchema = z.object({
    session: z.string().min(4),
    term: z.enum(["FIRST", "SECOND", "THIRD"]).default("THIRD"),
    studentIds: z.array(z.string().min(1)).min(1).max(500),
    action: z.enum(["promote", "repeat", "auto"]).default("auto"),
});
router.get("/sessions", async (req, res, next) => {
    try {
        const data = await termService.listActiveSessions(req.user);
        res.json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
});
router.get("/promotion-preview", validate(previewSchema, "query"), async (req, res, next) => {
    try {
        const data = await promoteService.previewPromotion({
            session: String(req.query.session),
            term: req.query.term || "THIRD",
            schoolId: req.user.schoolId,
            classId: req.query.classId ? String(req.query.classId) : undefined,
        });
        res.json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
});
router.post("/close", validate(closeTermSchema), async (req, res, next) => {
    try {
        const data = await termService.closeTerm({
            ...req.body,
            actorId: req.user.id,
            schoolId: req.user.schoolId,
        });
        res.json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
});
router.post("/promote", validate(promoteStudentsSchema), async (req, res, next) => {
    try {
        const data = await promoteService.promoteStudents({
            session: req.body.session,
            term: req.body.term,
            actorId: req.user.id,
            schoolId: req.user.schoolId,
        });
        res.json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
});
router.post("/promote-selected", validate(promoteSelectedSchema), async (req, res, next) => {
    try {
        const data = await promoteService.promoteSelectedStudents({
            session: req.body.session,
            term: req.body.term,
            studentIds: req.body.studentIds,
            action: req.body.action,
            actorId: req.user.id,
            schoolId: req.user.schoolId,
        });
        res.json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
});
export default router;
