const ALERTS = {
  PASSWORD_SET: {
    subject: "Un mot de passe a été ajouté à votre compte SwiftGoma",
    title: "Un mot de passe a été ajouté à votre compte",
    sms: "un mot de passe a été ajouté à votre compte",
  },
  PASSWORD_CHANGED: {
    subject: "Votre mot de passe SwiftGoma a été modifié",
    title: "Votre mot de passe a été modifié",
    sms: "votre mot de passe a été modifié",
  },
  PASSWORD_RESET: {
    subject: "Votre mot de passe SwiftGoma a été réinitialisé",
    title: "Votre mot de passe a été réinitialisé",
    sms: "votre mot de passe a été réinitialisé",
  },
  PASSWORD_REMOVED: {
    subject: "Le mot de passe de votre compte SwiftGoma a été retiré",
    title: "Le mot de passe a été retiré de votre compte",
    sms: "le mot de passe a été retiré de votre compte",
  },
};

const FALLBACK = {
  subject: "Changement de sécurité sur votre compte SwiftGoma",
  title: "Un changement de sécurité a été effectué sur votre compte",
  sms: "un changement de sécurité a été effectué sur votre compte",
};

function securityAlertInfo(type) {
  return ALERTS[type] ?? FALLBACK;
}

module.exports = { securityAlertInfo };
