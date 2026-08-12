// Purpose: Render start — ensure real schema (incl. multi-school), migrate, seed, boot.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");
process.chdir(apiRoot);

const entry = path.join(apiRoot, "dist", "index.js");
const buildScript = path.join(apiRoot, "scripts", "build.mjs");
const ensureSchemaScript = path.join(apiRoot, "scripts", "ensure-schema.mjs");
const ensureAdminScript = path.join(apiRoot, "scripts", "ensure-admin.mjs");
const ensureSuperAdminScript = path.join(apiRoot, "scripts", "ensure-super-admin.mjs");
const ensureSsSubjectsScript = path.join(apiRoot, "scripts", "ensure-ss-subjects.mjs");
const prismaBin = path.join(
  apiRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma"
);
const prismaCliJs = path.join(apiRoot, "node_modules", "prisma", "build", "index.js");

// Only mark migrations that ensure-schema has already applied idempotently.
const MIGRATIONS_TO_MARK_AFTER_ENSURE = [
  "20260806140000_terms_archive_notifications",
  "20260807180000_ensure_schema_idempotent",
  "20260811120000_multi_school_tenancy",
  "20260812180000_user_email_per_school",
];

function run(command, args, { shell = false, allowFail = false, env = process.env } = {}) {
  console.log(`> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env,
    cwd: apiRoot,
    shell,
  });
  if (result.error) {
    console.error(result.error);
    if (!allowFail) process.exit(1);
    return result.status ?? 1;
  }
  if (result.status !== 0 && !allowFail) {
    process.exit(result.status ?? 1);
  }
  return result.status ?? 0;
}

function prismaEnv() {
  return {
    ...process.env,
    DATABASE_URL: process.env.DIRECT_URL || process.env.DATABASE_URL,
  };
}

function runPrisma(args, opts = {}) {
  const env = prismaEnv();
  if (fs.existsSync(prismaBin)) {
    return run(prismaBin, args, { shell: process.platform === "win32", env, ...opts });
  }
  if (fs.existsSync(prismaCliJs)) {
    return run(process.execPath, [prismaCliJs, ...args], { env, ...opts });
  }
  return run("npx", ["prisma", ...args], { shell: true, env, ...opts });
}

// Always rebuild on Render so committed dist cannot drift from src/schema.
console.log("Building API from source...");
run(process.execPath, [buildScript]);

if (!fs.existsSync(entry)) {
  console.error("FATAL: dist/index.js missing after build.");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("FATAL: DATABASE_URL is not set — cannot migrate or start");
  process.exit(1);
}

if (!process.env.DIRECT_URL) {
  console.warn(
    "WARNING: DIRECT_URL is not set. Neon pooled DATABASE_URL may fail DDL. Set DIRECT_URL to the direct (non-pooler) connection string."
  );
}

// 1) Apply real DDL and VERIFY School/schoolId exist — fail boot if not.
console.log("Ensuring schema via DIRECT_URL (legacy + multi-school)...");
run(process.execPath, [ensureSchemaScript], { allowFail: false, env: prismaEnv() });

// 2) Record migrations as applied only AFTER ensure-schema verified the columns.
//    This repairs DBs where migrate was previously marked applied without DDL.
for (const name of MIGRATIONS_TO_MARK_AFTER_ENSURE) {
  runPrisma(["migrate", "resolve", "--applied", name], { allowFail: true });
}

console.log("Applying prisma migrate deploy...");
runPrisma(["migrate", "deploy"], { allowFail: true });

// Re-verify after migrate in case anything lagged.
run(process.execPath, [ensureSchemaScript], { allowFail: false, env: prismaEnv() });

console.log("Ensuring admin@sms.local login...");
run(process.execPath, [ensureAdminScript], { env: prismaEnv() });

console.log("Ensuring superadmin@sms.local login (seed only — no public signup)...");
run(process.execPath, [ensureSuperAdminScript], { env: prismaEnv() });

console.log("Ensuring SS Science / Arts / Commercial subject packs...");
run(process.execPath, [ensureSsSubjectsScript], { allowFail: true, env: prismaEnv() });

console.log("Starting API:", entry);
run(process.execPath, [entry]);
