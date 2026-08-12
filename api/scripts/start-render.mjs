// Purpose: Render start — build if needed, ensure schema, mark migrations applied, boot API.
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
const prismaBin = path.join(
  apiRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma"
);
const prismaCliJs = path.join(apiRoot, "node_modules", "prisma", "build", "index.js");

const MIGRATIONS_TO_MARK = [
  "20260806140000_terms_archive_notifications",
  "20260807180000_ensure_schema_idempotent",
  "20260811120000_multi_school_tenancy",
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

if (!fs.existsSync(entry)) {
  console.warn("dist/index.js missing at start — running build now...");
  run(process.execPath, [buildScript]);
}

if (!fs.existsSync(entry)) {
  console.error("FATAL: dist/index.js still missing after build.");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("FATAL: DATABASE_URL is not set — cannot migrate or start");
  process.exit(1);
}

console.log("Ensuring schema via DIRECT_URL (idempotent DDL)...");
run(process.execPath, [ensureSchemaScript], { allowFail: false, env: prismaEnv() });

console.log("Applying prisma migrate deploy...");
runPrisma(["migrate", "deploy"], { allowFail: true });

for (const name of MIGRATIONS_TO_MARK) {
  // If migrate deploy failed earlier, mark these as applied after ensure-schema succeeded.
  runPrisma(["migrate", "resolve", "--applied", name], { allowFail: true });
}

runPrisma(["migrate", "deploy"], { allowFail: true });

console.log("Ensuring admin@sms.local login...");
run(process.execPath, [ensureAdminScript], { env: prismaEnv() });

const ensureSuperAdminScript = path.join(apiRoot, "scripts", "ensure-super-admin.mjs");
console.log("Ensuring superadmin@sms.local login...");
run(process.execPath, [ensureSuperAdminScript], { env: prismaEnv() });

console.log("Starting API:", entry);
run(process.execPath, [entry]);
