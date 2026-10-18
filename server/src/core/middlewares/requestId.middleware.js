const crypto = require("crypto");
const Sentry = require("@sentry/node");

const VALID_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

function requestId(req, res, next) {
  const incoming = req.get("x-request-id");
  const id = incoming && VALID_REQUEST_ID.test(incoming) ? incoming : crypto.randomUUID();
  req.id = id;
  res.setHeader("X-Request-Id", id);
  Sentry.getCurrentScope().setTag("request_id", id);
  next();
}

module.exports = { requestId };
