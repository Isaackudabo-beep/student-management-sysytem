// Purpose: Ensure admin login works after deploy — valid bcrypt hash for admin@sms.local.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");
process.chdir(apiRoot);

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

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("ensure-admin: DATABASE_URL missing");
    process.exit(1);
  }

  const { PrismaClient } = require("@prisma/client");
  const bcrypt = require("bcryptjs");
  const prisma = new PrismaClient();

  const email = "admin@sms.local";
  const password = "Password123!";
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const defaultSchool =
      (await prisma.school.findFirst({ where: { code: "DEFAULT" } })) ||
      (await prisma.school.create({
        data: {
          id: "school_default_legacy",
          name: "Default School",
          code: "DEFAULT",
          status: "ACTIVE",
        },
      }));

    const existing = await prisma.user.findFirst({ where: { email, schoolId: defaultSchool.id } });
    if (!existing) {
      await prisma.user.create({
        data: {
          fullName: "System Admin",
          email,
          passwordHash,
          role: "ADMIN",
          schoolId: defaultSchool.id,
          mustChangePassword: false,
        },
      });
      console.log("ensure-admin: created", email);
    } else {
      // Repair invalid/corrupt hashes that cause bcrypt.compare to throw (HTTP 500).
      let hashOk = false;
      try {
        hashOk = await bcrypt.compare(password, existing.passwordHash);
      } catch {
        hashOk = false;
      }
      if (!hashOk || existing.role !== "ADMIN" || !existing.schoolId) {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            role: "ADMIN",
            schoolId: existing.schoolId || defaultSchool.id,
            mustChangePassword: false,
            fullName: existing.fullName || "System Admin",
          },
        });
        console.log("ensure-admin: repaired", email);
      } else {
        console.log("ensure-admin: ok", email);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("ensure-admin failed:", err);
  process.exit(1);
});
