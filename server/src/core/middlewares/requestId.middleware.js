const crypto = require("crypto");
const Sentry = require("@sentry/node");

function requestId(req, res, next) {
  const id = req.get("x-request-id") || crypto.randomUUID();
  req.id = id;
  res.setHeader("X-Request-Id", id);
  Sentry.getCurrentScope().setTag("request_id", id);
  next();
}

module.exports = { requestId };
