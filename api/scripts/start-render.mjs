// Purpose: Render start — build dist if missing, migrate, then boot dist/index.js.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");
process.chdir(apiRoot);

const entry = path.join(apiRoot, "dist", "index.js");
const buildScript = path.join(apiRoot, "scripts", "build.mjs");
const prismaCli = path.join(apiRoot, "node_modules", "prisma", "build", "index.js");

function run(command, args) {
  console.log(`> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
    cwd: apiRoot,
    shell: false,
  });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!fs.existsSync(entry)) {
  console.warn("dist/index.js missing at start — running build now...");
  run(process.execPath, [buildScript]);
}

if (!fs.existsSync(entry)) {
  console.error("FATAL: dist/index.js still missing after build.");
  console.error("cwd=", process.cwd());
  console.error("expected=", entry);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("FATAL: DATABASE_URL is not set");
  process.exit(1);
}

if (fs.existsSync(prismaCli)) {
  run(process.execPath, [prismaCli, "migrate", "deploy"]);
} else {
  console.warn("prisma CLI missing; skipping migrate deploy");
}

console.log("Starting API:", entry);
run(process.execPath, [entry]);
