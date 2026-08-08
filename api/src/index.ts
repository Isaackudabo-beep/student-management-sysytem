// Purpose: Process entrypoint — ensure schema, then start the HTTP server.
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { bootstrapSchema } from "./lib/schemaBootstrap.js";

async function main() {
  try {
    await bootstrapSchema();
  } catch (err) {
    console.warn("schemaBootstrap failed (continuing):", err);
  }

  const app = createApp();
  app.listen(env.PORT, "0.0.0.0", () => {
    console.log(`SMS API listening on port ${env.PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start API:", err);
  process.exit(1);
});
