// Purpose: Production build — Prisma generate + tsc via local binaries; verify dist/index.js.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");
process.chdir(apiRoot);

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgresql://build:build@127.0.0.1:5432/build?schema=public";
}
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

function bin(...parts) {
  return path.join(apiRoot, "node_modules", ...parts);
}

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

const prismaCli = bin("prisma", "build", "index.js");
const tscCli = bin("typescript", "bin", "tsc");

if (!fs.existsSync(prismaCli)) {
  console.error("Missing prisma CLI at", prismaCli);
  process.exit(1);
}
if (!fs.existsSync(tscCli)) {
  console.error("Missing TypeScript compiler at", tscCli);
  process.exit(1);
}

run(process.execPath, [prismaCli, "generate", "--schema", "prisma/schema.prisma"]);
run(process.execPath, [tscCli, "-p", "tsconfig.json"]);

const entry = path.join(apiRoot, "dist", "index.js");
if (!fs.existsSync(entry)) {
  console.error("BUILD FAILED: dist/index.js was not created.");
  console.error("Expected:", entry);
  process.exit(1);
}

console.log("BUILD OK:", entry);
