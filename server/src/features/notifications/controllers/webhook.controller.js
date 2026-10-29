const { getConfig } = require("../../../config/env.config");
const { safeEqual } = require("../../../core/crypto/crypto");
const { AppError } = require("../../../core/errors/AppError");
const service = require("../services/webhook.service");

function assertSecret(req) {
  const secret = getConfig().sms.webhookSecret;
  if (!secret) throw new AppError(503, "WEBHOOK_DISABLED", "Webhook non configuré");

  const provided = typeof req.query.key === "string" ? req.query.key : "";
  if (!safeEqual(provided, secret)) throw AppError.unauthorized("Clé invalide", "WEBHOOK_UNAUTHORIZED");
}

async function smsReport(req, res, next) {
  try {
    assertSecret(req);
    await service.recordSmsReport(req.body ?? {});
    res.status(200).send("OK");
  } catch (err) {
    next(err);
  }
}

module.exports = { smsReport };
