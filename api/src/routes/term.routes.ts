// Purpose: Admin term/session routes — list, close (archive), promote students.
import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { closeTermSchema, promoteStudentsSchema } from "../validators/schemas.js";
import * as termService from "../services/term.service.js";
import * as promoteService from "../services/promote.service.js";

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
    const data = await termService.closeTerm({
      ...req.body,
      actorId: req.user!.id,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post("/promote", validate(promoteStudentsSchema), async (req, res, next) => {
  try {
    const data = await promoteService.promoteStudents({
      session: req.body.session,
      term: req.body.term,
      actorId: req.user!.id,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
