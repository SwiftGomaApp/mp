require("net").setDefaultAutoSelectFamilyAttemptTimeout(5000);

require("./instrument");

const Sentry = require("@sentry/node");
const { loadConfig } = require("./src/config/env.config");
const { logger } = require("./src/core/logger/logger");
const { createApp } = require("./src/app");
const { setupGracefulShutdown, onShutdown, onShutdownStart } = require("./src/core/shutdown");
const { connectPrisma, disconnectPrisma } = require("./src/core/db/prisma");
const { connectRedis, disconnectRedis } = require("./src/core/cache/redis");
const { verifyMailer, closeMailer } = require("./src/core/mail/mailer");
const { closeQueues } = require("./src/core/queue/queues");
const {
  attachRealtime,
  disconnectAllSockets,
  closeRealtime,
} = require("./src/core/realtime/socket");

async function main() {
  const config = await loadConfig();
  if (config.isProd && !config.trustProxy) {
    logger.warn(
      "TRUST_PROXY is not set: behind a reverse proxy every client shares one IP and rate limits will not work",
    );
  }
  await connectPrisma();
  await connectRedis();
  await verifyMailer().catch((err) => logger.warn({ err }, "SMTP not reachable"));
  const app = createApp(config);

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, env: config.env }, "Server started");
  });

  attachRealtime(server);
  onShutdownStart("realtime", () => disconnectAllSockets());

  setupGracefulShutdown(server, {
    timeoutMs: 10000,
    onError: (err) => Sentry.captureException(err),
  });

  onShutdown("redis", () => disconnectRedis());
  onShutdown("queues", () => closeQueues());
  onShutdown("prisma", () => disconnectPrisma());
  onShutdown("mailer", () => closeMailer());
  onShutdown("sentry", () => Sentry.close(2000));
  onShutdown("realtime", () => closeRealtime());
}

main().catch((err) => {
  Sentry.captureException(err);
  logger.fatal({ err }, "Startup failed");
  Sentry.close(2000).finally(() => process.exit(1));
});
