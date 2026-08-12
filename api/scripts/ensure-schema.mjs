// Purpose: Apply idempotent DDL over DIRECT_URL so Neon pooled connections don't block schema fixes.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MULTI_SCHOOL_STATEMENTS, MULTI_SCHOOL_VERIFY_SQL } from "./multi-school-ddl.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");
process.chdir(apiRoot);

/** Load api/.env into process.env without printing values (local/dev convenience). */
function loadEnvFile() {
  const envPath = path.join(apiRoot, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile();

const require = createRequire(path.join(apiRoot, "package.json"));

const LEGACY_STATEMENTS = [
  `DO $$ BEGIN CREATE TYPE "Term" AS ENUM ('FIRST', 'SECOND', 'THIRD'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE "AcademicStatus" AS ENUM ('ACTIVE', 'PROMOTED', 'REPEATING'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TYPE "AnnouncementAudience" ADD VALUE 'CLASS'; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TYPE "AnnouncementAudience" ADD VALUE 'USER'; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "academicStatus" "AcademicStatus" NOT NULL DEFAULT 'ACTIVE'`,
  `CREATE INDEX IF NOT EXISTS "Student_academicStatus_idx" ON "Student"("academicStatus")`,
  `ALTER TABLE "Enrollment" ADD COLUMN IF NOT EXISTS "term" "Term" NOT NULL DEFAULT 'FIRST'`,
  `ALTER TABLE "Enrollment" DROP CONSTRAINT IF EXISTS "Enrollment_studentId_subjectId_session_key"`,
  `DROP INDEX IF EXISTS "Enrollment_studentId_subjectId_session_key"`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Enrollment_studentId_subjectId_session_term_key" ON "Enrollment"("studentId", "subjectId", "session", "term")`,
  `CREATE INDEX IF NOT EXISTS "Enrollment_session_term_idx" ON "Enrollment"("session", "term")`,
  `CREATE INDEX IF NOT EXISTS "TeacherSubject_session_idx" ON "TeacherSubject"("session")`,
  `CREATE TABLE IF NOT EXISTS "ResultArchive" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "session" TEXT NOT NULL,
    "term" "Term" NOT NULL,
    "subjectCode" TEXT NOT NULL,
    "subjectTitle" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "assessment" DOUBLE PRECISION NOT NULL,
    "exam" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "grade" TEXT NOT NULL,
    "remark" TEXT NOT NULL,
    "teacherName" TEXT,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResultArchive_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "ResultArchive_studentId_idx" ON "ResultArchive"("studentId")`,
  `CREATE INDEX IF NOT EXISTS "ResultArchive_session_term_idx" ON "ResultArchive"("session", "term")`,
  `DO $$ BEGIN ALTER TABLE "ResultArchive" ADD CONSTRAINT "ResultArchive_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "targetClassId" TEXT`,
  `ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "targetUserId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "Announcement_targetClassId_idx" ON "Announcement"("targetClassId")`,
  `CREATE INDEX IF NOT EXISTS "Announcement_targetUserId_idx" ON "Announcement"("targetUserId")`,
  `DO $$ BEGIN ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_targetClassId_fkey" FOREIGN KEY ("targetClassId") REFERENCES "SchoolClass"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
];

const STATEMENTS = [...LEGACY_STATEMENTS, ...MULTI_SCHOOL_STATEMENTS];

function truthy(v) {
  return v === true || v === "t" || v === 1 || v === "1";
}

async function verify(prisma) {
  const legacy = await prisma.$queryRawUnsafe(`
    SELECT
      EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Student' AND column_name='academicStatus') AS student_status,
      EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Enrollment' AND column_name='term') AS enrollment_term,
      EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ResultArchive') AS result_archive,
      EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Announcement' AND column_name='targetClassId') AS ann_class,
      EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Announcement' AND column_name='targetUserId') AS ann_user
  `);
  const legacyRow = Array.isArray(legacy) ? legacy[0] : legacy;
  console.log("ensure-schema legacy verify:", legacyRow);

  const multi = await prisma.$queryRawUnsafe(MULTI_SCHOOL_VERIFY_SQL);
  const multiRow = Array.isArray(multi) ? multi[0] : multi;
  console.log("ensure-schema multi-school verify:", multiRow);

  if (
    !truthy(legacyRow?.student_status) ||
    !truthy(legacyRow?.enrollment_term) ||
    !truthy(legacyRow?.result_archive) ||
    !truthy(legacyRow?.ann_class) ||
    !truthy(legacyRow?.ann_user)
  ) {
    throw new Error(`Legacy schema verification failed: ${JSON.stringify(legacyRow)}`);
  }

  if (
    !truthy(multiRow?.school_table) ||
    !truthy(multiRow?.user_school) ||
    !truthy(multiRow?.student_school) ||
    !truthy(multiRow?.teacher_school) ||
    !truthy(multiRow?.class_school) ||
    !truthy(multiRow?.subject_school) ||
    !truthy(multiRow?.ann_school) ||
    !truthy(multiRow?.default_school)
  ) {
    throw new Error(`Multi-school schema verification failed: ${JSON.stringify(multiRow)}`);
  }

  return true;
}

async function main() {
  const direct = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!direct) {
    console.error("ensure-schema: DATABASE_URL/DIRECT_URL missing");
    process.exit(1);
  }

  if (!process.env.DIRECT_URL) {
    console.warn(
      "ensure-schema: DIRECT_URL is not set — using DATABASE_URL. For Neon, set DIRECT_URL to the non-pooled connection string."
    );
  }

  process.env.DATABASE_URL = direct;
  // DDL scripts should use a tiny pool against the direct host (avoid pooler timeouts).
  if (!/[?&]connection_limit=/.test(process.env.DATABASE_URL)) {
    process.env.DATABASE_URL +=
      (process.env.DATABASE_URL.includes("?") ? "&" : "?") + "connection_limit=1&pool_timeout=60";
  }

  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();

  try {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await runStatements(prisma);
        await verify(prisma);
        console.log("ensure-schema: OK (legacy + multi-school)");
        break;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (attempt < maxAttempts && /timeout|P1001|can't reach|ECONN|pool/i.test(message)) {
          console.warn(`ensure-schema attempt ${attempt} failed (retrying):`, message.split("\n")[0]);
          await new Promise((r) => setTimeout(r, 5000 * attempt));
          continue;
        }
        throw err;
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function runStatements(prisma) {
  for (const sql of STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        /already exists|duplicate|conflict/i.test(message) ||
        message.includes("42710") ||
        message.includes("42P07")
      ) {
        console.warn("ensure-schema skip:", message.split("\n")[0]);
        continue;
      }
      console.error("ensure-schema statement failed:", message);
      throw err;
    }
  }
}

main().catch(async (err) => {
  console.error("ensure-schema failed:", err);
  process.exit(1);
});
