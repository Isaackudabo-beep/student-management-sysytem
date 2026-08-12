// Purpose: Teacher HTTP routes + assign / unassign subjects.
import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { assignTeacherSchema, assignTeacherSubjectsSchema, createTeacherSchema, searchQuerySchema, updateTeacherSchema, } from "../validators/schemas.js";
import * as teacherService from "../services/teacher.service.js";
import { z } from "zod";
const router = Router();
router.use(authenticate);
router.get("/", authorize("ADMIN"), validate(searchQuerySchema, "query"), async (req, res, next) => {
    try {
        const result = await teacherService.listTeachers(req.query, req.user);
        res.json({ success: true, ...result });
    }
    catch (error) {
        next(error);
    }
});
router.get("/unassigned-subjects", authorize("ADMIN"), validate(z.object({ session: z.string().min(4) }), "query"), async (req, res, next) => {
    try {
        const data = await teacherService.listUnassignedSubjects(String(req.query.session), req.user);
        res.json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
});
router.post("/", authorize("ADMIN"), validate(createTeacherSchema), async (req, res, next) => {
    try {
        const teacher = await teacherService.createTeacher(req.body, req.user);
        res.status(201).json({ success: true, data: teacher });
    }
    catch (error) {
        next(error);
    }
});
router.post("/assign-subject", authorize("ADMIN"), validate(assignTeacherSchema), async (req, res, next) => {
    try {
        const assignment = await teacherService.assignTeacherToSubject(req.body, req.user);
        res.status(201).json({ success: true, data: assignment });
    }
    catch (error) {
        next(error);
    }
});
router.post("/assign-subjects", authorize("ADMIN"), validate(assignTeacherSubjectsSchema), async (req, res, next) => {
    try {
        const data = await teacherService.assignTeacherSubjects(req.body, req.user);
        res.status(201).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
});
router.delete("/assignments/:assignmentId", authorize("ADMIN"), async (req, res, next) => {
    try {
        const data = await teacherService.removeTeacherSubject(req.params.assignmentId, req.user);
        res.json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
});
router.get("/:id", authorize("ADMIN"), async (req, res, next) => {
    try {
        const teacher = await teacherService.getTeacherById(req.params.id, req.user);
        res.json({ success: true, data: teacher });
    }
    catch (error) {
        next(error);
    }
});
router.patch("/:id", authorize("ADMIN"), validate(updateTeacherSchema), async (req, res, next) => {
    try {
        const teacher = await teacherService.updateTeacher(req.params.id, req.body, req.user);
        res.json({ success: true, data: teacher });
    }
    catch (error) {
        next(error);
    }
});
router.delete("/:id", authorize("ADMIN"), async (req, res, next) => {
    try {
        const result = await teacherService.deleteTeacher(req.params.id, req.user);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
export default router;
