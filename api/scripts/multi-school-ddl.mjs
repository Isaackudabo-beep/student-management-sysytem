// Purpose: Shared idempotent multi-school DDL for ensure-schema + boot repair (no data deletes).
export const MULTI_SCHOOL_STATEMENTS = [
  `DO $$ BEGIN CREATE TYPE "SchoolStatus" AS ENUM ('ACTIVE', 'SUSPENDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
     ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
   EXCEPTION
     WHEN duplicate_object THEN NULL;
     WHEN others THEN
       BEGIN
         ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';
       EXCEPTION WHEN duplicate_object THEN NULL;
       END;
   END $$`,
  `CREATE TABLE IF NOT EXISTS "School" (
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
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "School_code_key" ON "School"("code")`,
  `CREATE INDEX IF NOT EXISTS "School_status_idx" ON "School"("status")`,
  `CREATE INDEX IF NOT EXISTS "School_name_idx" ON "School"("name")`,
  `INSERT INTO "School" ("id", "name", "code", "address", "status", "createdAt", "updatedAt")
   SELECT 'school_default_legacy', 'Default School', 'DEFAULT', 'Migrated existing workspace', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
   WHERE NOT EXISTS (SELECT 1 FROM "School" WHERE "code" = 'DEFAULT')`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "schoolId" TEXT`,
  `ALTER TABLE "SchoolClass" ADD COLUMN IF NOT EXISTS "schoolId" TEXT`,
  `ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "schoolId" TEXT`,
  `ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "schoolId" TEXT`,
  `ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "schoolId" TEXT`,
  `ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "schoolId" TEXT`,
  `UPDATE "User" SET "schoolId" = (SELECT "id" FROM "School" WHERE "code" = 'DEFAULT' LIMIT 1)
   WHERE "schoolId" IS NULL AND "role"::text <> 'SUPER_ADMIN'`,
  `UPDATE "SchoolClass" SET "schoolId" = (SELECT "id" FROM "School" WHERE "code" = 'DEFAULT' LIMIT 1) WHERE "schoolId" IS NULL`,
  `UPDATE "Student" SET "schoolId" = (SELECT "id" FROM "School" WHERE "code" = 'DEFAULT' LIMIT 1) WHERE "schoolId" IS NULL`,
  `UPDATE "Teacher" SET "schoolId" = (SELECT "id" FROM "School" WHERE "code" = 'DEFAULT' LIMIT 1) WHERE "schoolId" IS NULL`,
  `UPDATE "Subject" SET "schoolId" = (SELECT "id" FROM "School" WHERE "code" = 'DEFAULT' LIMIT 1) WHERE "schoolId" IS NULL`,
  `UPDATE "Announcement" SET "schoolId" = (SELECT "id" FROM "School" WHERE "code" = 'DEFAULT' LIMIT 1) WHERE "schoolId" IS NULL`,
  `DO $$ BEGIN
     IF EXISTS (SELECT 1 FROM "SchoolClass" WHERE "schoolId" IS NULL) THEN
       RAISE EXCEPTION 'SchoolClass rows missing schoolId after backfill';
     END IF;
   END $$`,
  `ALTER TABLE "SchoolClass" ALTER COLUMN "schoolId" SET NOT NULL`,
  `ALTER TABLE "Student" ALTER COLUMN "schoolId" SET NOT NULL`,
  `ALTER TABLE "Teacher" ALTER COLUMN "schoolId" SET NOT NULL`,
  `ALTER TABLE "Subject" ALTER COLUMN "schoolId" SET NOT NULL`,
  `ALTER TABLE "Announcement" ALTER COLUMN "schoolId" SET NOT NULL`,
  `DO $$ BEGIN ALTER TABLE "User" ADD CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "SchoolClass" ADD CONSTRAINT "SchoolClass_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "Subject" ADD CONSTRAINT "Subject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `ALTER TABLE "SchoolClass" DROP CONSTRAINT IF EXISTS "SchoolClass_name_key"`,
  `DROP INDEX IF EXISTS "SchoolClass_name_key"`,
  `ALTER TABLE "Subject" DROP CONSTRAINT IF EXISTS "Subject_code_key"`,
  `DROP INDEX IF EXISTS "Subject_code_key"`,
  `ALTER TABLE "Student" DROP CONSTRAINT IF EXISTS "Student_admissionNumber_key"`,
  `DROP INDEX IF EXISTS "Student_admissionNumber_key"`,
  `ALTER TABLE "Student" DROP CONSTRAINT IF EXISTS "Student_matricNumber_key"`,
  `DROP INDEX IF EXISTS "Student_matricNumber_key"`,
  `ALTER TABLE "Student" DROP CONSTRAINT IF EXISTS "Student_email_key"`,
  `DROP INDEX IF EXISTS "Student_email_key"`,
  `ALTER TABLE "Teacher" DROP CONSTRAINT IF EXISTS "Teacher_email_key"`,
  `DROP INDEX IF EXISTS "Teacher_email_key"`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "SchoolClass_schoolId_name_key" ON "SchoolClass"("schoolId", "name")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Subject_schoolId_code_key" ON "Subject"("schoolId", "code")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Student_schoolId_admissionNumber_key" ON "Student"("schoolId", "admissionNumber")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Student_schoolId_matricNumber_key" ON "Student"("schoolId", "matricNumber")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Student_schoolId_email_key" ON "Student"("schoolId", "email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Teacher_schoolId_email_key" ON "Teacher"("schoolId", "email")`,
  `CREATE INDEX IF NOT EXISTS "User_schoolId_idx" ON "User"("schoolId")`,
  `CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role")`,
  `CREATE INDEX IF NOT EXISTS "SchoolClass_schoolId_idx" ON "SchoolClass"("schoolId")`,
  `CREATE INDEX IF NOT EXISTS "Student_schoolId_idx" ON "Student"("schoolId")`,
  `CREATE INDEX IF NOT EXISTS "Teacher_schoolId_idx" ON "Teacher"("schoolId")`,
  `CREATE INDEX IF NOT EXISTS "Subject_schoolId_idx" ON "Subject"("schoolId")`,
  `CREATE INDEX IF NOT EXISTS "Announcement_schoolId_idx" ON "Announcement"("schoolId")`,
];

export const MULTI_SCHOOL_VERIFY_SQL = `
  SELECT
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='School') AS school_table,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='User' AND column_name='schoolId') AS user_school,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Student' AND column_name='schoolId') AS student_school,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Teacher' AND column_name='schoolId') AS teacher_school,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='SchoolClass' AND column_name='schoolId') AS class_school,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Subject' AND column_name='schoolId') AS subject_school,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Announcement' AND column_name='schoolId') AS ann_school,
    EXISTS(SELECT 1 FROM "School" WHERE "code"='DEFAULT') AS default_school
`;
