require("./instrument");

const Sentry = require("@sentry/node");
const express = require("express");
const { loadConfig } = require("./src/config/env.config");

async function main() {
  const config = await loadConfig();

  const app = express();
  app.use(express.json());

  app.get("/api/v1/health", (req, res) => res.json({ status: "ok" }));

  if (!config.isProd) {
    app.get("/api/v1/debug-sentry", () => {
      throw new Error("Sentry test error");
    });
  }

  Sentry.setupExpressErrorHandler(app);

  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({
      error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    });
  });

  const server = app.listen(config.port, () => {
    console.log(`Server running on port ${config.port} (${config.env})`);
  });

  const shutdown = async () => {
    server.close();
    await Sentry.close(2000);
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  Sentry.captureException(err);
  console.error(err.message);
  Sentry.close(2000).finally(() => process.exit(1));
});
