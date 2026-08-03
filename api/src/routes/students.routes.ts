// Purpose: Student HTTP routes — Admin CRUD; Admin/Teacher can list/search/view.
import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createStudentSchema,
  searchQuerySchema,
  updateStudentSchema,
} from "../validators/schemas.js";
import * as studentService from "../services/student.service.js";

const router = Router();

router.use(authenticate);

router.get("/", authorize("ADMIN", "TEACHER"), validate(searchQuerySchema, "query"), async (req, res, next) => {
  try {
    const result = await studentService.listStudents(req.query as never);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", authorize("ADMIN", "TEACHER"), async (req, res, next) => {
  try {
    const student = await studentService.getStudentById(req.params.id);
    res.json({ success: true, data: student });
  } catch (error) {
    next(error);
  }
});

router.post("/", authorize("ADMIN"), validate(createStudentSchema), async (req, res, next) => {
  try {
    const student = await studentService.createStudent(req.body);
    res.status(201).json({ success: true, data: student });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", authorize("ADMIN"), validate(updateStudentSchema), async (req, res, next) => {
  try {
    const student = await studentService.updateStudent(req.params.id, req.body);
    res.json({ success: true, data: student });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", authorize("ADMIN"), async (req, res, next) => {
  try {
    const result = await studentService.deleteStudent(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
