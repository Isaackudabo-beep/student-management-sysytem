// Purpose: Admin term/session routes — list sessions and close term without touching teacher assignments.
import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import * as termService from "../services/term.service.js";

const closeTermSchema = z.object({
  session: z.string().min(4, "Session is required"),
  clearEnrollments: z.boolean().default(true),
});

const router = Router();

router.use(authenticate);
router.use(authorize("ADMIN"));

router.get("/sessions", async (_req, res, next) => {
  try {
    const data = await termService.listActiveSessions();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post("/close", validate(closeTermSchema), async (req, res, next) => {
  try {
    const data = await termService.closeTerm(req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
