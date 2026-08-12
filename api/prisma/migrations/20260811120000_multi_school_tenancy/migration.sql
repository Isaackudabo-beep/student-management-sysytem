-- Multi-school tenancy: School tenant + schoolId on school-owned tables + SUPER_ADMIN role.
-- Safe for prisma migrate deploy: backfills existing rows into a default school.

-- 1) Enums
DO $$ BEGIN
  CREATE TYPE "SchoolStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
EXCEPTION WHEN others THEN
  -- ADD VALUE IF NOT EXISTS is PG 9.1+; older fallback
  BEGIN
    ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 2) School table
CREATE TABLE IF NOT EXISTS "School" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "address" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "status" "SchoolStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "School_code_key" ON "School"("code");
CREATE INDEX IF NOT EXISTS "School_status_idx" ON "School"("status");
CREATE INDEX IF NOT EXISTS "School_name_idx" ON "School"("name");

-- 3) Default school for existing data
INSERT INTO "School" ("id", "name", "code", "address", "status", "createdAt", "updatedAt")
SELECT 'school_default_legacy', 'Default School', 'DEFAULT', 'Migrated existing workspace', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "School" WHERE "code" = 'DEFAULT');

-- 4) Add nullable schoolId columns
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "SchoolClass" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;

-- 5) Backfill (non-SUPER_ADMIN users + all school entities)
UPDATE "User" SET "schoolId" = (SELECT "id" FROM "School" WHERE "code" = 'DEFAULT' LIMIT 1)
WHERE "schoolId" IS NULL AND "role"::text <> 'SUPER_ADMIN';

UPDATE "SchoolClass" SET "schoolId" = (SELECT "id" FROM "School" WHERE "code" = 'DEFAULT' LIMIT 1)
WHERE "schoolId" IS NULL;

UPDATE "Student" SET "schoolId" = (SELECT "id" FROM "School" WHERE "code" = 'DEFAULT' LIMIT 1)
WHERE "schoolId" IS NULL;

UPDATE "Teacher" SET "schoolId" = (SELECT "id" FROM "School" WHERE "code" = 'DEFAULT' LIMIT 1)
WHERE "schoolId" IS NULL;

UPDATE "Subject" SET "schoolId" = (SELECT "id" FROM "School" WHERE "code" = 'DEFAULT' LIMIT 1)
WHERE "schoolId" IS NULL;

UPDATE "Announcement" SET "schoolId" = (SELECT "id" FROM "School" WHERE "code" = 'DEFAULT' LIMIT 1)
WHERE "schoolId" IS NULL;

-- 6) NOT NULL for school-owned tables (User stays nullable for SUPER_ADMIN)
ALTER TABLE "SchoolClass" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Student" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Teacher" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Subject" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Announcement" ALTER COLUMN "schoolId" SET NOT NULL;

-- 7) Foreign keys
DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SchoolClass" ADD CONSTRAINT "SchoolClass_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Subject" ADD CONSTRAINT "Subject_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8) Drop global uniques that become per-school
ALTER TABLE "SchoolClass" DROP CONSTRAINT IF EXISTS "SchoolClass_name_key";
DROP INDEX IF EXISTS "SchoolClass_name_key";

ALTER TABLE "Subject" DROP CONSTRAINT IF EXISTS "Subject_code_key";
DROP INDEX IF EXISTS "Subject_code_key";

ALTER TABLE "Student" DROP CONSTRAINT IF EXISTS "Student_admissionNumber_key";
DROP INDEX IF EXISTS "Student_admissionNumber_key";
ALTER TABLE "Student" DROP CONSTRAINT IF EXISTS "Student_matricNumber_key";
DROP INDEX IF EXISTS "Student_matricNumber_key";
ALTER TABLE "Student" DROP CONSTRAINT IF EXISTS "Student_email_key";
DROP INDEX IF EXISTS "Student_email_key";

ALTER TABLE "Teacher" DROP CONSTRAINT IF EXISTS "Teacher_email_key";
DROP INDEX IF EXISTS "Teacher_email_key";

-- 9) Per-school unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolClass_schoolId_name_key" ON "SchoolClass"("schoolId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "Subject_schoolId_code_key" ON "Subject"("schoolId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "Student_schoolId_admissionNumber_key" ON "Student"("schoolId", "admissionNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "Student_schoolId_matricNumber_key" ON "Student"("schoolId", "matricNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "Student_schoolId_email_key" ON "Student"("schoolId", "email");
CREATE UNIQUE INDEX IF NOT EXISTS "Teacher_schoolId_email_key" ON "Teacher"("schoolId", "email");

CREATE INDEX IF NOT EXISTS "User_schoolId_idx" ON "User"("schoolId");
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
CREATE INDEX IF NOT EXISTS "SchoolClass_schoolId_idx" ON "SchoolClass"("schoolId");
CREATE INDEX IF NOT EXISTS "Student_schoolId_idx" ON "Student"("schoolId");
CREATE INDEX IF NOT EXISTS "Teacher_schoolId_idx" ON "Teacher"("schoolId");
CREATE INDEX IF NOT EXISTS "Subject_schoolId_idx" ON "Subject"("schoolId");
CREATE INDEX IF NOT EXISTS "Announcement_schoolId_idx" ON "Announcement"("schoolId");
