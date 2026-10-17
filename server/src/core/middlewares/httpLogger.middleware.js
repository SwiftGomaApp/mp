const pinoHttp = require("pino-http");
const { logger } = require("../logger/logger");

const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.id,
  autoLogging: {
    ignore: (req) => req.url === "/api/v1/health",
  },
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.originalUrl} ${res.statusCode}`,
  customErrorMessage: (req, res) => `${req.method} ${req.originalUrl} ${res.statusCode}`,
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url, ip: req.remoteAddress }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});

module.exports = { httpLogger };
