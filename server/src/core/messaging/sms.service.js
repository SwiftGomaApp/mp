const { sendSms } = require("./sms");

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

module.exports = { sendOtpSms, sendLoginAlertSms, otpMessage };
