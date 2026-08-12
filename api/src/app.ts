// Purpose: Express app assembly — middleware, routes, error handling.
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.routes.js";
import studentsRoutes from "./routes/students.routes.js";
import teachersRoutes from "./routes/teachers.routes.js";
import subjectsRoutes from "./routes/subjects.routes.js";
import enrollmentsRoutes from "./routes/enrollments.routes.js";
import scoresRoutes from "./routes/scores.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import classesRoutes from "./routes/classes.routes.js";
import announcementsRoutes from "./routes/announcements.routes.js";
import termRoutes from "./routes/term.routes.js";
import platformRoutes from "./routes/platform.routes.js";

export function createApp() {
  const app = express();

  // Support one origin or a comma-separated list (e.g. production + preview).
  const allowedOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Allow non-browser clients (no Origin header) and configured frontends.
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
          return callback(null, true);
        }
        return callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

  app.get("/health", (_req, res) => {
    res.json({ success: true, message: "SMS API is healthy" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/platform", platformRoutes);
  app.use("/api/students", studentsRoutes);
  app.use("/api/teachers", teachersRoutes);
  app.use("/api/subjects", subjectsRoutes);
  app.use("/api/enrollments", enrollmentsRoutes);
  app.use("/api/scores", scoresRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/classes", classesRoutes);
  app.use("/api/announcements", announcementsRoutes);
  app.use("/api/term", termRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
