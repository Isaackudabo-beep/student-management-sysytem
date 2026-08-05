// Purpose: Production build for Render — generate Prisma client, compile TS, verify dist/index.js.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");
process.chdir(apiRoot);

// prisma generate validates datasource env vars even though it does not connect.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://build:build@127.0.0.1:5432/build?schema=public";
}
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

function run(command, args) {
  console.log(`> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
    shell: true,
    cwd: apiRoot,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npx", ["prisma", "generate", "--schema", "prisma/schema.prisma"]);
run("npx", ["tsc", "-p", "tsconfig.json"]);

const entry = path.join(apiRoot, "dist", "index.js");
if (!fs.existsSync(entry)) {
  console.error("BUILD FAILED: dist/index.js was not created.");
  console.error(`Expected file: ${entry}`);
  console.error("Contents of dist/ (if any):");
  const distDir = path.join(apiRoot, "dist");
  if (fs.existsSync(distDir)) {
    for (const name of fs.readdirSync(distDir)) console.error(` - ${name}`);
  } else {
    console.error(" dist/ directory does not exist");
  }
  process.exit(1);
}

console.log(`BUILD OK: ${entry}`);
