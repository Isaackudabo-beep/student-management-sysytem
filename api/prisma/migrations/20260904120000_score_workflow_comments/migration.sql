-- Score approval workflow + term report comments (non-destructive).

DO $$ BEGIN
  CREATE TYPE "ScoreStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PUBLISHED', 'RETURNED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Score" ADD COLUMN IF NOT EXISTS "status" "ScoreStatus";
ALTER TABLE "Score" ADD COLUMN IF NOT EXISTS "returnNote" TEXT;
ALTER TABLE "Score" ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);
ALTER TABLE "Score" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "Score" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);

-- Preserve existing production visibility: treat current scores as already published.
UPDATE "Score"
SET
  "status" = 'PUBLISHED',
  "submittedAt" = COALESCE("submittedAt", "createdAt"),
  "approvedAt" = COALESCE("approvedAt", "createdAt"),
  "publishedAt" = COALESCE("publishedAt", "createdAt")
WHERE "status" IS NULL;

ALTER TABLE "Score" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';
ALTER TABLE "Score" ALTER COLUMN "status" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Score_status_idx" ON "Score"("status");

CREATE TABLE IF NOT EXISTS "TermReportComment" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "session" TEXT NOT NULL,
  "term" "Term" NOT NULL,
  "teacherComment" TEXT,
  "principalComment" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TermReportComment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TermReportComment_studentId_session_term_key"
  ON "TermReportComment"("studentId", "session", "term");
CREATE INDEX IF NOT EXISTS "TermReportComment_schoolId_idx" ON "TermReportComment"("schoolId");
CREATE INDEX IF NOT EXISTS "TermReportComment_session_term_idx" ON "TermReportComment"("session", "term");

DO $$ BEGIN
  ALTER TABLE "TermReportComment"
    ADD CONSTRAINT "TermReportComment_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
