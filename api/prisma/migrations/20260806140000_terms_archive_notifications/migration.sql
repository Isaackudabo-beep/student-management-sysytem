-- Idempotent terms/archive/notification schema (safe to re-run).
DO $$ BEGIN
  CREATE TYPE "Term" AS ENUM ('FIRST', 'SECOND', 'THIRD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AcademicStatus" AS ENUM ('ACTIVE', 'PROMOTED', 'REPEATING');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AnnouncementAudience" ADD VALUE 'CLASS';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AnnouncementAudience" ADD VALUE 'USER';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "academicStatus" "AcademicStatus" NOT NULL DEFAULT 'ACTIVE';
CREATE INDEX IF NOT EXISTS "Student_academicStatus_idx" ON "Student"("academicStatus");

ALTER TABLE "Enrollment" ADD COLUMN IF NOT EXISTS "term" "Term" NOT NULL DEFAULT 'FIRST';

ALTER TABLE "Enrollment" DROP CONSTRAINT IF EXISTS "Enrollment_studentId_subjectId_session_key";
DROP INDEX IF EXISTS "Enrollment_studentId_subjectId_session_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Enrollment_studentId_subjectId_session_term_key"
  ON "Enrollment"("studentId", "subjectId", "session", "term");
CREATE INDEX IF NOT EXISTS "Enrollment_session_term_idx" ON "Enrollment"("session", "term");
CREATE INDEX IF NOT EXISTS "TeacherSubject_session_idx" ON "TeacherSubject"("session");

CREATE TABLE IF NOT EXISTS "ResultArchive" (
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
);

CREATE INDEX IF NOT EXISTS "ResultArchive_studentId_idx" ON "ResultArchive"("studentId");
CREATE INDEX IF NOT EXISTS "ResultArchive_session_term_idx" ON "ResultArchive"("session", "term");

DO $$ BEGIN
  ALTER TABLE "ResultArchive" ADD CONSTRAINT "ResultArchive_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "targetClassId" TEXT;
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "targetUserId" TEXT;
CREATE INDEX IF NOT EXISTS "Announcement_targetClassId_idx" ON "Announcement"("targetClassId");
CREATE INDEX IF NOT EXISTS "Announcement_targetUserId_idx" ON "Announcement"("targetUserId");

DO $$ BEGIN
  ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_targetClassId_fkey"
    FOREIGN KEY ("targetClassId") REFERENCES "SchoolClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_targetUserId_fkey"
    FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
