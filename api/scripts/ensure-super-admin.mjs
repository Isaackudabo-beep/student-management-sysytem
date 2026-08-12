// Purpose: Ensure platform SUPER_ADMIN exists after deploy.
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");
process.chdir(apiRoot);

const require = createRequire(path.join(apiRoot, "package.json"));

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("ensure-super-admin: DATABASE_URL missing");
    process.exit(1);
  }

  const { PrismaClient } = require("@prisma/client");
  const bcrypt = require("bcryptjs");
  const prisma = new PrismaClient();

  const email = "superadmin@sms.local";
  const password = "Password123!";
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      await prisma.user.create({
        data: {
          fullName: "Platform Super Admin",
          email,
          passwordHash,
          role: "SUPER_ADMIN",
          schoolId: null,
          mustChangePassword: false,
        },
      });
      console.log("ensure-super-admin: created", email);
    } else {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          role: "SUPER_ADMIN",
          schoolId: null,
          mustChangePassword: false,
          fullName: existing.fullName || "Platform Super Admin",
        },
      });
      console.log("ensure-super-admin: ensured", email);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
