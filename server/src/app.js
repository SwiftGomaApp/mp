const Sentry = require("@sentry/node");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");
const morgan = require("morgan");
const { isShuttingDown } = require("./core/shutdown");
const { requestId } = require("./core/middlewares/requestId.middleware");
const { notFoundHandler, errorHandler } = require("./core/middlewares/error.middleware");
const { getPrisma } = require("./core/db/prisma");
const { getRedis } = require("./core/cache/redis");

function createApp(config) {
  const app = express();

  if (config.isProd) app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(requestId);

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

  app.get("/api/v1/health", async (req, res, next) => {
    if (isShuttingDown()) return res.status(503).json({ status: "shutting_down" });
    try {
      await Promise.all([getPrisma().$queryRaw`SELECT 1`, getRedis().ping()]);
      res.json({ status: "ok", database: "up", redis: "up" });
    } catch (err) {
      next(err);
    }
  });

  if (!config.isProd) {
    app.get("/api/v1/debug-sentry", () => {
      throw new Error("Sentry test error");
    });
  }

  app.use(notFoundHandler);

  Sentry.setupExpressErrorHandler(app);

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
