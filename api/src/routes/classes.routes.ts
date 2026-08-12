// Purpose: SchoolClass HTTP routes.
import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createSchoolClassSchema,
  searchQuerySchema,
  updateSchoolClassSchema,
} from "../validators/schemas.js";
import * as classService from "../services/class.service.js";

const router = Router();

router.use(authenticate);

router.get("/", validate(searchQuerySchema, "query"), async (req, res, next) => {
  try {
    const result = await classService.listClasses(req.query as never, req.user!);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const data = await classService.getClassById(req.params.id, req.user!);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post("/", authorize("ADMIN"), validate(createSchoolClassSchema), async (req, res, next) => {
  try {
    const data = await classService.createClass(req.body, req.user!);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.patch(
  "/:id",
  authorize("ADMIN"),
  validate(updateSchoolClassSchema),
  async (req, res, next) => {
    try {
      const data = await classService.updateClass(req.params.id, req.body, req.user!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

router.delete("/:id", authorize("ADMIN"), async (req, res, next) => {
  try {
    const data = await classService.deleteClass(req.params.id, req.user!);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
