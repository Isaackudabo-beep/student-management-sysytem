// Purpose: Ensure admin login works after deploy — valid bcrypt hash for admin@sms.local.
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");
process.chdir(apiRoot);

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
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      await prisma.user.create({
        data: {
          fullName: "System Admin",
          email,
          passwordHash,
          role: "ADMIN",
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
      if (!hashOk || existing.role !== "ADMIN") {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            role: "ADMIN",
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
