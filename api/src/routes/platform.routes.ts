// Purpose: Platform SUPER_ADMIN HTTP routes — schools and school admins only.
import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import * as platformService from "../services/platform.service.js";

const router = Router();

router.use(authenticate);
router.use(authorize("SUPER_ADMIN"));

const pageSchema = z.object({
  q: z.string().optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const createSchoolSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(32).optional(),
  address: z.string().max(240).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  admin: z
    .object({
      fullName: z.string().min(2).max(120),
      email: z.string().email(),
      password: z.string().min(8),
    })
    .optional(),
});

const updateSchoolSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  address: z.string().max(240).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  email: z.string().email().nullable().optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
});

const statusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});

const createAdminSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8),
});

router.get("/overview", async (_req, res, next) => {
  try {
    const data = await platformService.platformOverview();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/schools", validate(pageSchema, "query"), async (req, res, next) => {
  try {
    const result = await platformService.listSchools(req.query as never);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

router.post("/schools", validate(createSchoolSchema), async (req, res, next) => {
  try {
    const data = await platformService.createSchool(req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/schools/:id", async (req, res, next) => {
  try {
    const data = await platformService.getSchool(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.patch("/schools/:id", validate(updateSchoolSchema), async (req, res, next) => {
  try {
    const data = await platformService.updateSchool(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post("/schools/:id/status", validate(statusSchema), async (req, res, next) => {
  try {
    const data = await platformService.setSchoolStatus(req.params.id, req.body.status);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/schools/:id/admins", async (req, res, next) => {
  try {
    const data = await platformService.listSchoolAdmins(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post("/schools/:id/admins", validate(createAdminSchema), async (req, res, next) => {
  try {
    const data = await platformService.createSchoolAdmin(req.params.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
