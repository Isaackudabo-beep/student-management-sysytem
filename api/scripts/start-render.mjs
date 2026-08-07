// Purpose: Render start — build if needed, migrate/ensure schema, bootstrap admin, boot API.
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

function runPrisma(args, opts = {}) {
  const env = {
    ...process.env,
    // Neon DDL/migrations need the direct (non-pooled) URL when available.
    DATABASE_URL: process.env.DIRECT_URL || process.env.DATABASE_URL,
  };
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

console.log("Applying database migrations (prisma migrate deploy)...");
runPrisma(["migrate", "deploy"], { allowFail: true });

console.log("Ensuring schema via DIRECT_URL (idempotent DDL)...");
run(process.execPath, [ensureSchemaScript], { allowFail: false });

runPrisma(["migrate", "deploy"], { allowFail: true });

console.log("Ensuring admin@sms.local login...");
run(process.execPath, [ensureAdminScript]);

console.log("Starting API:", entry);
run(process.execPath, [entry]);
