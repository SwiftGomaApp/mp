const { sendSms } = require("./sms");
const { securityAlertInfo } = require("./securityAlert");

function otpMessage({ code, expiresMinutes }) {
  return `SwiftGoma : votre code est SWG-${code}. Il expire dans ${expiresMinutes} min. Ne le partagez jamais.`;
}

async function sendOtpSms({ to, code, expiresMinutes }) {
  return sendSms({ to, message: otpMessage({ code, expiresMinutes }) });
}

async function sendLoginAlertSms({ to, deviceName, location }) {
  return sendSms({
    to,
    message: `SwiftGoma : nouvelle connexion depuis ${deviceName} (${location}). Si ce n'est pas vous, sécurisez votre compte.`,
  });
}

async function sendWelcomeSms({ to, name, role }) {
  const actions = {
    SELLER: "Envoyez vos documents pour activer votre boutique",
    RIDER: "Envoyez vos documents pour pouvoir livrer",
  };
  const action = actions[role] ?? "Découvrez les boutiques de Goma et commandez";
  const hello = name ? `bienvenue ${name}` : "bienvenue";
  return sendSms({ to, message: `SwiftGoma : ${hello} ! ${action} dans l'application.` });
}

function securityAlertMessage({ type }) {
  return `SwiftGoma : ${securityAlertInfo(type).sms}. Si ce n'est pas vous, sécurisez votre compte.`;
}

async function sendSecurityAlertSms({ to, type }) {
  return sendSms({ to, message: securityAlertMessage({ type }) });
}

const SMS_MAX_LENGTH = 160;

async function sendNotificationSms({ to, title, body }) {
  const message = `SwiftGoma : ${title}. ${body}`;
  return sendSms({ to, message: message.slice(0, SMS_MAX_LENGTH) });
}

module.exports = {
  sendNotificationSms,
  sendOtpSms,
  sendLoginAlertSms,
  otpMessage,
  sendWelcomeSms,
  sendSecurityAlertSms,
  securityAlertMessage,
};
