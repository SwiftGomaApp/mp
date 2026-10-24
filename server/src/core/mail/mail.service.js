const { sendMail } = require("./mailer");
const { otpTemplate } = require("./templates/otp.template");
const { loginAlertTemplate } = require("./templates/loginAlert.template");
const { welcomeTemplate } = require("./templates/welcome.template");
const { securityAlertTemplate } = require("./templates/securityAlert.template");

async function sendOtpEmail({ to, name, code, expiresMinutes }) {
  const { subject, html, text } = otpTemplate({ name, code, expiresMinutes });
  return sendMail({ to, subject, html, text });
}

async function sendLoginAlertEmail({ to, name, deviceName, location, country, date, activityUrl }) {
  const { subject, html, text } = loginAlertTemplate({
    name,
    deviceName,
    location,
    country,
    date,
    activityUrl,
  });
  return sendMail({ to, subject, html, text });
}

async function sendWelcomeEmail({ to, name, role }) {
  const { subject, html, text } = welcomeTemplate({ name, role });
  return sendMail({ to, subject, html, text });
}

async function sendSecurityAlertEmail({ to, name, type, date, activityUrl }) {
  const { subject, html, text } = securityAlertTemplate({ name, type, date, activityUrl });
  return sendMail({ to, subject, html, text });
}

module.exports = { sendOtpEmail, sendLoginAlertEmail, sendWelcomeEmail, sendSecurityAlertEmail };
