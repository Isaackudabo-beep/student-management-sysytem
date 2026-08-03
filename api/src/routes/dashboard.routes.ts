// Purpose: Dashboard stats endpoint.
import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import * as dashboardService from "../services/dashboard.service.js";

const router = Router();

router.get("/", authenticate, async (req, res, next) => {
  try {
    const stats = await dashboardService.getDashboardStats(req.user!);
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

export default router;
