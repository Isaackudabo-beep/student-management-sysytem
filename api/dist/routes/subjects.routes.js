// Purpose: Subject HTTP routes — Admin manage; Admin/Teacher list.
import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createSubjectSchema, searchQuerySchema, updateSubjectSchema, } from "../validators/schemas.js";
import * as subjectService from "../services/subject.service.js";
const router = Router();
router.use(authenticate);
router.get("/", authorize("ADMIN", "TEACHER"), validate(searchQuerySchema, "query"), async (req, res, next) => {
    try {
        const result = await subjectService.listSubjects(req.query, req.user);
        res.json({ success: true, ...result });
    }
    catch (error) {
        next(error);
    }
});
router.get("/:id", authorize("ADMIN", "TEACHER"), async (req, res, next) => {
    try {
        const subject = await subjectService.getSubjectById(req.params.id, req.user);
        res.json({ success: true, data: subject });
    }
    catch (error) {
        next(error);
    }
});
router.post("/", authorize("ADMIN"), validate(createSubjectSchema), async (req, res, next) => {
    try {
        const subject = await subjectService.createSubject(req.body, req.user);
        res.status(201).json({ success: true, data: subject });
    }
    catch (error) {
        next(error);
    }
});
router.patch("/:id", authorize("ADMIN"), validate(updateSubjectSchema), async (req, res, next) => {
    try {
        const subject = await subjectService.updateSubject(req.params.id, req.body, req.user);
        res.json({ success: true, data: subject });
    }
    catch (error) {
        next(error);
    }
});
router.delete("/:id", authorize("ADMIN"), async (req, res, next) => {
    try {
        const result = await subjectService.deleteSubject(req.params.id, req.user);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
export default router;
