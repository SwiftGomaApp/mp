const { logger } = require("./logger/logger");

const hooks = [];
let shuttingDown = false;

const startHooks = [];

function onShutdownStart(name, fn) {
  startHooks.push({ name, fn });
}

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
    logger.info({ reason }, "Shutting down");

    const timer = setTimeout(() => {
      logger.error("Shutdown timed out, forcing exit");
      process.exit(1);
    }, timeoutMs);
    timer.unref();

    for (const { name, fn } of startHooks) {
      try {
        await fn();
      } catch (err) {
        logger.error({ err, resource: name }, "Error before closing");
      }
    }

    server.close(async () => {
      for (const { name, fn } of [...hooks].reverse()) {
        try {
          await fn();
          logger.info({ resource: name }, "Closed");
        } catch (err) {
          logger.error({ err, resource: name }, "Error while closing");
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
    logger.fatal({ err: reason }, "Unhandled rejection");
    onError?.(reason);
    shutdown("unhandledRejection", 1);
  });

  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "Uncaught exception");
    onError?.(err);
    shutdown("uncaughtException", 1);
  });
}

module.exports = { setupGracefulShutdown, onShutdown, isShuttingDown, onShutdownStart };
