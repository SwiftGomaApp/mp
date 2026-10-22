const Sentry = require("@sentry/node");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const { requestId } = require("./core/middlewares/requestId.middleware");
const { httpLogger } = require("./core/middlewares/httpLogger.middleware");
const { notFoundHandler, errorHandler } = require("./core/middlewares/error.middleware");
const { globalLimiter } = require("./core/middlewares/rateLimit.middleware");
const routes = require("./routes");

function createApp(config) {
  const app = express();

  if (config.trustProxy) app.set("trust proxy", config.trustProxy);
  app.disable("x-powered-by");
  app.use(requestId);
  app.use(httpLogger);

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
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.use("/api/v1", globalLimiter);
  app.use("/api/v1", routes);

  app.use(notFoundHandler);

  Sentry.setupExpressErrorHandler(app);

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
