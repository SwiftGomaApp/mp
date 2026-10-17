require("./instrument");

const Sentry = require("@sentry/node");
const { loadConfig } = require("./src/config/env.config");
const { logger } = require("./src/core/logger/logger");
const { createApp } = require("./src/app");
const { setupGracefulShutdown, onShutdown } = require("./src/core/shutdown");
const { connectPrisma, disconnectPrisma } = require("./src/core/db/prisma");
const { connectRedis, disconnectRedis } = require("./src/core/cache/redis");

async function main() {
  const config = await loadConfig();
  await connectPrisma();
  await connectRedis();
  const app = createApp(config);

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, env: config.env }, "Server started");
  });

  setupGracefulShutdown(server, {
    timeoutMs: 10000,
    onError: (err) => Sentry.captureException(err),
  });

  onShutdown("redis", () => disconnectRedis());
  onShutdown("prisma", () => disconnectPrisma());
  onShutdown("sentry", () => Sentry.close(2000));
}

main().catch((err) => {
  Sentry.captureException(err);
  logger.fatal({ err }, "Startup failed");
  Sentry.close(2000).finally(() => process.exit(1));
});
