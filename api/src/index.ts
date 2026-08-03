// Purpose: Process entrypoint — starts the HTTP server.
import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`SMS API listening on http://localhost:${env.PORT}`);
});
