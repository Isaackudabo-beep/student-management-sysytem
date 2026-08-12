// Purpose: Auth HTTP routes — role login, password change/reset, profile.
import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  adminResetPasswordSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
} from "../validators/schemas.js";
import * as authService from "../services/auth.service.js";

const router = Router();

router.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const result = await authService.login(
      req.body.email,
      req.body.password,
      req.body.expectedRole
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user!.id);
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

router.post("/change-password", authenticate, validate(changePasswordSchema), async (req, res, next) => {
  try {
    const result = await authService.changePassword(req.user!.id, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/admin/reset-password",
  authenticate,
  authorize("ADMIN"),
  validate(adminResetPasswordSchema),
  async (req, res, next) => {
    try {
      const result = await authService.adminResetPassword(
        req.user!.schoolId!,
        req.body.userId,
        req.body.temporaryPassword
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

router.post("/forgot-password", validate(forgotPasswordSchema), async (req, res, next) => {
  try {
    const result = await authService.forgotPassword(req.body.email);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
