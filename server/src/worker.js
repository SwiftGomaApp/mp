require("../instrument");

const Sentry = require("@sentry/node");
const { loadConfig } = require("./config/env.config");
const { logger } = require("./core/logger/logger");
const { disconnectPrisma } = require("./core/db/prisma");
const { closeMailer } = require("./core/mail/mailer");
const { startWorkers } = require("./core/queue/workers");
const { processors } = require("./jobs");

async function main() {
  await loadConfig();

  const closeWorkers = startWorkers(processors);

  let shuttingDown = false;

  async function shutdown(reason, exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ reason }, "Worker shutting down");

    const timer = setTimeout(() => {
      logger.error("Worker shutdown timed out, forcing exit");
      process.exit(1);
    }, 15000);
    timer.unref();

    try {
      await closeWorkers();
      await closeMailer();
      await disconnectPrisma();
      await Sentry.close(2000);
    } catch (err) {
      logger.error({ err }, "Error during worker shutdown");
      exitCode = 1;
    }

    clearTimeout(timer);
    process.exit(exitCode);
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (err) => {
    logger.fatal({ err }, "Unhandled rejection");
    Sentry.captureException(err);
    shutdown("unhandledRejection", 1);
  });
  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "Uncaught exception");
    Sentry.captureException(err);
    shutdown("uncaughtException", 1);
  });
}

main().catch((err) => {
  Sentry.captureException(err);
  logger.fatal({ err }, "Worker startup failed");
  Sentry.close(2000).finally(() => process.exit(1));
});
