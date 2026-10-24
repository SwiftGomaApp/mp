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
  const action =
    role === "SELLER"
      ? "Envoyez vos documents pour activer votre boutique"
      : "Découvrez les boutiques de Goma et commandez";
  const hello = name ? `bienvenue ${name}` : "bienvenue";
  return sendSms({ to, message: `SwiftGoma : ${hello} ! ${action} dans l'application.` });
}

function securityAlertMessage({ type }) {
  return `SwiftGoma : ${securityAlertInfo(type).sms}. Si ce n'est pas vous, sécurisez votre compte.`;
}

async function sendSecurityAlertSms({ to, type }) {
  return sendSms({ to, message: securityAlertMessage({ type }) });
}

module.exports = {
  sendOtpSms,
  sendLoginAlertSms,
  otpMessage,
  sendWelcomeSms,
  sendSecurityAlertSms,
  securityAlertMessage,
};
