const AfricasTalking = require("africastalking");
const { getConfig } = require("../../config/env.config");
const { logger } = require("../logger/logger");
const { AppError } = require("../errors/AppError");
const { isValidDrcPhone } = require("../validation/phone");

const ACCEPTED_CODES = new Set([100, 101, 102]);

let client = null;

function getSmsClient() {
  if (client) return client;
  const { username, apiKey } = getConfig().sms;
  client = AfricasTalking({ username, apiKey }).SMS;
  return client;
}

function maskPhone(phone) {
  const value = String(phone || "");
  return value.length > 6 ? `${value.slice(0, 6)}***${value.slice(-2)}` : "***";
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("SMS provider timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function unavailable() {
  return new AppError(
    503,
    "SMS_UNAVAILABLE",
    "L'envoi du SMS est impossible pour le moment, veuillez réessayer",
  );
}

async function sendSms({ to, message }) {
  if (!isValidDrcPhone(to)) {
    throw AppError.badRequest("Numéro de téléphone invalide", null, "INVALID_PHONE");
  }

  const { senderId, dryRun, timeoutMs } = getConfig().sms;

  if (dryRun) {
    logger.info({ to: maskPhone(to), message }, "SMS dry run");
    return { messageId: "dry-run", cost: null, status: "DryRun" };
  }

  let response;
  try {
    response = await withTimeout(
      getSmsClient().send({
        to: [to],
        message,
        ...(senderId ? { from: senderId } : {}),
      }),
      timeoutMs,
    );
  } catch (err) {
    logger.error(
      {
        to: maskPhone(to),
        status: err.response?.status,
        reason: err.response?.data ?? err.message,
      },
      "SMS provider request failed",
    );
    throw unavailable();
  }

  const recipient = response?.SMSMessageData?.Recipients?.[0];

  if (!recipient || !ACCEPTED_CODES.has(Number(recipient.statusCode))) {
    const statusCode = Number(recipient?.statusCode);
    logger.error(
      {
        to: maskPhone(to),
        statusCode: Number.isNaN(statusCode) ? null : statusCode,
        status: recipient?.status,
        providerMessage: response?.SMSMessageData?.Message,
      },
      "SMS rejected by provider",
    );
    if (statusCode === 403 || statusCode === 404) {
      throw AppError.badRequest("Numéro de téléphone invalide", null, "INVALID_PHONE");
    }
    throw unavailable();
  }

  logger.info(
    { to: maskPhone(to), messageId: recipient.messageId, cost: recipient.cost },
    "SMS sent",
  );

  return { messageId: recipient.messageId, cost: recipient.cost, status: recipient.status };
}

module.exports = { sendSms, isValidDrcPhone, maskPhone };
