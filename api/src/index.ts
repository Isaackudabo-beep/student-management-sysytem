// Purpose: Process entrypoint — starts the HTTP server.
import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

// Bind 0.0.0.0 so Render/Railway health checks can reach the service.
app.listen(env.PORT, "0.0.0.0", () => {
  console.log(`SMS API listening on port ${env.PORT}`);
});
