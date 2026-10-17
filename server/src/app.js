const Sentry = require("@sentry/node");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");
const morgan = require("morgan");
const { isShuttingDown } = require("./core/shutdown");

function createApp(config) {
  const app = express();

  if (config.isProd) app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
        return cb(new Error("Not allowed by CORS"));
      },
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(morgan(config.isProd ? "combined" : "dev"));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/v1/health", (req, res) => {
    if (isShuttingDown()) return res.status(503).json({ status: "shutting_down" });
    res.json({ status: "ok" });
  });

  if (!config.isProd) {
    app.get("/api/v1/debug-sentry", () => {
      throw new Error("Sentry test error");
    });
  }

  app.use((req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  Sentry.setupExpressErrorHandler(app);

  app.use((err, req, res, next) => {
    const status = err.status || 500;
    res.status(status).json({
      error: {
        code: status === 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR",
        message: status === 500 ? "Something went wrong" : err.message,
      },
    });
  });

  return app;
}

module.exports = { createApp };
