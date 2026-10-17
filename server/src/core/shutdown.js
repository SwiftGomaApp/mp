const hooks = [];
let shuttingDown = false;

function onShutdown(name, fn) {
  hooks.push({ name, fn });
}

function isShuttingDown() {
  return shuttingDown;
}

function setupGracefulShutdown(server, { timeoutMs = 10000, onError } = {}) {
  async function shutdown(reason, exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Shutting down (${reason})...`);

    const timer = setTimeout(() => {
      console.error("Shutdown timed out, forcing exit");
      process.exit(1);
    }, timeoutMs);
    timer.unref();

    server.close(async () => {
      for (const { name, fn } of [...hooks].reverse()) {
        try {
          await fn();
          console.log(`Closed: ${name}`);
        } catch (err) {
          console.error(`Error closing ${name}:`, err.message);
        }
      }
      clearTimeout(timer);
      process.exit(exitCode);
    });

    server.closeIdleConnections?.();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled rejection:", reason);
    onError?.(reason);
    shutdown("unhandledRejection", 1);
  });

  process.on("uncaughtException", (err) => {
    console.error("Uncaught exception:", err);
    onError?.(err);
    shutdown("uncaughtException", 1);
  });
}

module.exports = { setupGracefulShutdown, onShutdown, isShuttingDown };
