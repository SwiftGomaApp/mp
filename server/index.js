require("./instrument");

const Sentry = require("@sentry/node");
const { loadConfig } = require("./src/config/env.config");
const { createApp } = require("./src/app");
const { setupGracefulShutdown, onShutdown } = require("./src/core/shutdown");

async function main() {
  const config = await loadConfig();
  const app = createApp(config);

  const server = app.listen(config.port, () => {
    console.log(`Server running on port ${config.port} (${config.env})`);
  });

  setupGracefulShutdown(server, {
    timeoutMs: 10000,
    onError: (err) => Sentry.captureException(err),
  });

  onShutdown("sentry", () => Sentry.close(2000));
}

main().catch((err) => {
  Sentry.captureException(err);
  console.error(err.message);
  Sentry.close(2000).finally(() => process.exit(1));
});
