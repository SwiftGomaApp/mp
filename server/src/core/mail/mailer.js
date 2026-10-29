const nodemailer = require("nodemailer");
const { getConfig } = require("../../config/env.config");
const { logger } = require("../logger/logger");

let transport = null;
let marketingTransport = null;

function createPooledTransport({ host, port, secure, user, pass }) {
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    pool: true,
    maxConnections: 3,
    connectionTimeout: 10000,
    socketTimeout: 15000,
  });
}

function getTransport() {
  if (transport) return transport;
  transport = createPooledTransport(getConfig().smtp);
  return transport;
}

/**
 * Marketing mail uses its own sender when one is configured, so complaints about promotions
 * cannot damage the reputation of the transactional sender that delivers login codes.
 */
function getMarketingTransport() {
  const { smtp } = getConfig().marketing;
  if (!smtp) return getTransport();
  if (marketingTransport) return marketingTransport;
  marketingTransport = createPooledTransport(smtp);
  return marketingTransport;
}

async function verifyMailer() {
  await getTransport().verify();
}

async function sendMail({ to, subject, html, text }) {
  const info = await getTransport().sendMail({
    from: getConfig().smtp.from,
    to,
    subject,
    html,
    text,
  });
  logger.info({ messageId: info.messageId, subject }, "Email sent");
  return info;
}

async function sendMarketingMail({ to, subject, html, text, headers }) {
  const { marketing, smtp } = getConfig();
  const info = await getMarketingTransport().sendMail({
    from: marketing.from || smtp.from,
    to,
    subject,
    html,
    text,
    headers,
  });
  logger.info({ messageId: info.messageId }, "Marketing email sent");
  return info;
}

async function closeMailer() {
  for (const current of [transport, marketingTransport]) current?.close();
  transport = null;
  marketingTransport = null;
}

module.exports = { sendMail, sendMarketingMail, verifyMailer, closeMailer };
