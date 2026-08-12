-- Purpose: Scope User.email uniqueness per school (same email allowed across tenants).
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_key";
DROP INDEX IF EXISTS "User_email_key";

CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");

-- School users: unique email within each school.
CREATE UNIQUE INDEX IF NOT EXISTS "User_schoolId_email_key"
  ON "User"("schoolId", "email")
  WHERE "schoolId" IS NOT NULL;

-- Platform SUPER_ADMIN: unique email among accounts with no school.
CREATE UNIQUE INDEX IF NOT EXISTS "User_platform_email_key"
  ON "User"("email")
  WHERE "schoolId" IS NULL;
