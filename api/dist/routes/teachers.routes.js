// Purpose: Teacher HTTP routes + assign teacher to subject.
import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { assignTeacherSchema, createTeacherSchema, searchQuerySchema, } from "../validators/schemas.js";
import * as teacherService from "../services/teacher.service.js";
const router = Router();
router.use(authenticate);
router.get("/", authorize("ADMIN"), validate(searchQuerySchema, "query"), async (req, res, next) => {
    try {
        const result = await teacherService.listTeachers(req.query);
        res.json({ success: true, ...result });
    }
    catch (error) {
        next(error);
    }
});
router.post("/", authorize("ADMIN"), validate(createTeacherSchema), async (req, res, next) => {
    try {
        const teacher = await teacherService.createTeacher(req.body);
        res.status(201).json({ success: true, data: teacher });
    }
    catch (error) {
        next(error);
    }
});
// Static path before /:id so "assign-subject" is never captured as an id.
router.post("/assign-subject", authorize("ADMIN"), validate(assignTeacherSchema), async (req, res, next) => {
    try {
        const assignment = await teacherService.assignTeacherToSubject(req.body);
        res.status(201).json({ success: true, data: assignment });
    }
    catch (error) {
        next(error);
    }
});
router.get("/:id", authorize("ADMIN"), async (req, res, next) => {
    try {
        const teacher = await teacherService.getTeacherById(req.params.id);
        res.json({ success: true, data: teacher });
    }
    catch (error) {
        next(error);
    }
});
router.delete("/:id", authorize("ADMIN"), async (req, res, next) => {
    try {
        const result = await teacherService.deleteTeacher(req.params.id);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
export default router;
