-- CreateEnum
CREATE TYPE "Term" AS ENUM ('FIRST', 'SECOND', 'THIRD');
CREATE TYPE "AcademicStatus" AS ENUM ('ACTIVE', 'PROMOTED', 'REPEATING');

-- AlterEnum AnnouncementAudience
ALTER TYPE "AnnouncementAudience" ADD VALUE 'CLASS';
ALTER TYPE "AnnouncementAudience" ADD VALUE 'USER';

-- AlterTable Student
ALTER TABLE "Student" ADD COLUMN "academicStatus" "AcademicStatus" NOT NULL DEFAULT 'ACTIVE';
CREATE INDEX "Student_academicStatus_idx" ON "Student"("academicStatus");

-- AlterTable Enrollment: add term, rebuild unique
ALTER TABLE "Enrollment" ADD COLUMN "term" "Term" NOT NULL DEFAULT 'FIRST';

ALTER TABLE "Enrollment" DROP CONSTRAINT IF EXISTS "Enrollment_studentId_subjectId_session_key";
DROP INDEX IF EXISTS "Enrollment_studentId_subjectId_session_key";

CREATE UNIQUE INDEX "Enrollment_studentId_subjectId_session_term_key"
  ON "Enrollment"("studentId", "subjectId", "session", "term");
CREATE INDEX "Enrollment_session_term_idx" ON "Enrollment"("session", "term");

CREATE INDEX IF NOT EXISTS "TeacherSubject_session_idx" ON "TeacherSubject"("session");

-- ResultArchive
CREATE TABLE "ResultArchive" (
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

CREATE INDEX "ResultArchive_studentId_idx" ON "ResultArchive"("studentId");
CREATE INDEX "ResultArchive_session_term_idx" ON "ResultArchive"("session", "term");

ALTER TABLE "ResultArchive" ADD CONSTRAINT "ResultArchive_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Announcement targeting
ALTER TABLE "Announcement" ADD COLUMN "targetClassId" TEXT;
ALTER TABLE "Announcement" ADD COLUMN "targetUserId" TEXT;

CREATE INDEX "Announcement_targetClassId_idx" ON "Announcement"("targetClassId");
CREATE INDEX "Announcement_targetUserId_idx" ON "Announcement"("targetUserId");

ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_targetClassId_fkey"
  FOREIGN KEY ("targetClassId") REFERENCES "SchoolClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
