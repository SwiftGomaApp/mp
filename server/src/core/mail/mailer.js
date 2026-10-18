const nodemailer = require("nodemailer");
const { getConfig } = require("../../config/env.config");
const { logger } = require("../logger/logger");

let transport = null;

function getTransport() {
  if (transport) return transport;

  const { host, port, secure, user, pass } = getConfig().smtp;

  transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    pool: true,
    maxConnections: 3,
    connectionTimeout: 10000,
    socketTimeout: 15000,
  });

  return transport;
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

async function closeMailer() {
  if (!transport) return;
  transport.close();
  transport = null;
}

module.exports = { sendMail, verifyMailer, closeMailer };
