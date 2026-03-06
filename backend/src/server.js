import { config } from "./config/index.js";
import { initDb, closeDb } from "./db/index.js";
import { rateLimiter } from "./services/rate-limiter.js";
import { logBuffer } from "./services/log-buffer.js";
import { usageCounter } from "./services/usage-counter.js";
import { startLogPruning, stopLogPruning } from "./controllers/logs.controller.js";
import { createApp } from "./app.js";

// ── Initialize ────────────────────────────────────────────────────────
const db = await initDb();
await rateLimiter.warm(db);
logBuffer.start();
usageCounter.start();
startLogPruning();

const app = createApp();
const PORT = config.port;

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} [${config.nodeEnv}]`);
});

// ── Error handling ────────────────────────────────────────────────────
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n❌ Port ${PORT} is already in use.`);
    console.error(`   To find the process: lsof -i :${PORT}`);
    console.error(`   To kill it: kill -9 $(lsof -t -i :${PORT})\n`);
  } else {
    console.error("Server error:", err);
  }
  process.exit(1);
});

// ── Graceful shutdown ─────────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`\n${signal} received — shutting down gracefully...`);

  // Force-kill if graceful shutdown stalls (e.g. keep-alive connections)
  const forceTimeout = setTimeout(() => {
    console.error("Graceful shutdown timed out after 10s — forcing exit");
    process.exit(1);
  }, 10_000);
  forceTimeout.unref(); // don't keep event loop alive just for the timer

  server.close(async () => {
    console.log("Server closed");
    await logBuffer.shutdown();
    await usageCounter.shutdown();
    stopLogPruning();
    await closeDb();
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
