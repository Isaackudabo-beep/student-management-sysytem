// Purpose: Announcement HTTP routes — admin CRUD + inbox/read for all roles.
import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createAnnouncementSchema } from "../validators/schemas.js";
import * as announcementService from "../services/announcement.service.js";
const pageSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(500).default(20),
});
const router = Router();
router.use(authenticate);
router.get("/inbox", async (req, res, next) => {
    try {
        const data = await announcementService.getInbox(req.user);
        res.json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
});
router.post("/:id/read", async (req, res, next) => {
    try {
        const data = await announcementService.markRead(req.params.id, req.user);
        res.json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
});
router.get("/", authorize("ADMIN"), validate(pageSchema, "query"), async (req, res, next) => {
    try {
        const result = await announcementService.listAnnouncementsAdmin(req.query);
        res.json({ success: true, ...result });
    }
    catch (error) {
        next(error);
    }
});
router.post("/", authorize("ADMIN"), validate(createAnnouncementSchema), async (req, res, next) => {
    try {
        const data = await announcementService.createAnnouncement(req.body, req.user);
        res.status(201).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
});
router.delete("/:id", authorize("ADMIN"), async (req, res, next) => {
    try {
        const data = await announcementService.deleteAnnouncement(req.params.id);
        res.json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
});
export default router;
