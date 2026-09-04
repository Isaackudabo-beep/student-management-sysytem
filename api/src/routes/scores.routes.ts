// Purpose: Score and results HTTP routes with role-based access + approval workflow.
import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { upsertScoreSchema } from "../validators/schemas.js";
import * as scoreService from "../services/score.service.js";
import * as resultWorkflow from "../services/resultWorkflow.service.js";

const termEnum = z.enum(["FIRST", "SECOND", "THIRD"]);

const listSchema = z.object({
  studentId: z.string().optional(),
  subjectId: z.string().optional(),
  session: z.string().optional(),
  term: termEnum.optional(),
  classId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
});

const bulkSchema = z.object({
  scores: z
    .array(
      z.object({
        enrollmentId: z.string().min(1),
        assessment: z.coerce.number().min(0).max(40),
        exam: z.coerce.number().min(0).max(60),
      })
    )
    .min(1)
    .max(200),
  asDraft: z.boolean().optional(),
});

const sheetQuerySchema = z.object({
  session: z.string().min(4),
  term: termEnum,
  classId: z.string().optional(),
});

const sheetActionSchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  session: z.string().min(4),
  term: termEnum,
  returnNote: z.string().max(500).optional(),
});

const broadsheetSchema = z.object({
  session: z.string().min(4),
  term: termEnum,
  classId: z.string().min(1),
});

const reportCardSchema = z.object({
  session: z.string().min(4),
  term: termEnum,
});

const commentsSchema = z.object({
  studentId: z.string().min(1),
  session: z.string().min(4),
  term: termEnum,
  teacherComment: z.string().max(1000).nullable().optional(),
  principalComment: z.string().max(1000).nullable().optional(),
});

const upsertWithDraftSchema = upsertScoreSchema.extend({
  asDraft: z.boolean().optional(),
});

const router = Router();

router.use(authenticate);

router.get("/", validate(listSchema, "query"), async (req, res, next) => {
  try {
    const result = await scoreService.listScores({
      actor: req.user!,
      ...(req.query as object),
    } as never);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

router.get("/review", authorize("ADMIN", "TEACHER"), validate(sheetQuerySchema, "query"), async (req, res, next) => {
  try {
    const data = await resultWorkflow.listResultSheets(req.query as never, req.user!);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/sheet", authorize("ADMIN", "TEACHER"), validate(sheetActionSchema, "query"), async (req, res, next) => {
  try {
    const data = await resultWorkflow.getSheetDetail(req.query as never, req.user!);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/broadsheet", authorize("ADMIN", "TEACHER"), validate(broadsheetSchema, "query"), async (req, res, next) => {
  try {
    const data = await resultWorkflow.getBroadsheet(req.query as never, req.user!);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get(
  "/report-card/:studentId",
  validate(reportCardSchema, "query"),
  async (req, res, next) => {
    try {
      const data = await resultWorkflow.getReportCard(
        req.params.studentId,
        req.query as never,
        req.user!
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

router.get("/results/:studentId", async (req, res, next) => {
  try {
    const results = await scoreService.getStudentResults(req.params.studentId, req.user!);
    res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
});

router.post("/", authorize("TEACHER"), validate(upsertWithDraftSchema), async (req, res, next) => {
  try {
    const score = await scoreService.upsertScore(req.body, req.user!);
    res.status(201).json({ success: true, data: score });
  } catch (error) {
    next(error);
  }
});

router.post("/bulk", authorize("TEACHER"), validate(bulkSchema), async (req, res, next) => {
  try {
    const result = await resultWorkflow.bulkUpsertScores(req.body, req.user!);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.post("/approve", authorize("ADMIN"), validate(sheetActionSchema), async (req, res, next) => {
  try {
    const data = await resultWorkflow.transitionSheet({ ...req.body, action: "approve" }, req.user!);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post("/publish", authorize("ADMIN"), validate(sheetActionSchema), async (req, res, next) => {
  try {
    const data = await resultWorkflow.transitionSheet({ ...req.body, action: "publish" }, req.user!);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post("/return", authorize("ADMIN"), validate(sheetActionSchema), async (req, res, next) => {
  try {
    const data = await resultWorkflow.transitionSheet({ ...req.body, action: "return" }, req.user!);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.put("/comments", authorize("ADMIN", "TEACHER"), validate(commentsSchema), async (req, res, next) => {
  try {
    const data = await resultWorkflow.upsertTermComments(req.body, req.user!);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", authorize("ADMIN", "TEACHER"), async (req, res, next) => {
  try {
    const result = await scoreService.deleteScore(req.params.id, req.user!);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
