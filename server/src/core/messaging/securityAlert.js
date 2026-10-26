const ALERTS = {
  LOGIN_METHOD_ADDED: {
    subject: "Une nouvelle méthode de connexion a été ajoutée à votre compte SwiftGoma",
    title: "Une nouvelle méthode de connexion a été ajoutée",
    sms: "une nouvelle méthode de connexion a été ajoutée à votre compte",
  },
  LOGIN_METHOD_REMOVED: {
    subject: "Une méthode de connexion a été retirée de votre compte SwiftGoma",
    title: "Une méthode de connexion a été retirée",
    sms: "une méthode de connexion a été retirée de votre compte",
  },
  PASSKEY_REMOVED: {
    subject: "Une empreinte ou un visage a été retiré de votre compte SwiftGoma",
    title: "Une empreinte ou un visage a été retiré de votre compte",
    sms: "une empreinte ou un visage a été retiré de votre compte",
  },
  SECONDARY_CONTACT_ADDED: {
    subject: "Un contact secondaire a été ajouté à votre compte SwiftGoma",
    title: "Un contact secondaire a été ajouté à votre compte",
    sms: "un contact secondaire a été ajouté à votre compte",
  },
  TWO_FACTOR_ENABLED: {
    subject: "La double vérification a été activée sur votre compte SwiftGoma",
    title: "La double vérification a été activée",
    sms: "la double vérification a été activée sur votre compte",
  },
  TWO_FACTOR_DISABLED: {
    subject: "La double vérification a été désactivée sur votre compte SwiftGoma",
    title: "La double vérification a été désactivée",
    sms: "la double vérification a été désactivée sur votre compte",
  },
  BACKUP_CODES_REGENERATED: {
    subject: "Vos codes de secours SwiftGoma ont été régénérés",
    title: "Vos codes de secours ont été régénérés",
    sms: "vos codes de secours ont été régénérés",
  },
  BACKUP_CODE_USED: {
    subject: "Un code de secours SwiftGoma a été utilisé",
    title: "Un code de secours a été utilisé pour vous connecter",
    sms: "un code de secours a été utilisé pour vous connecter",
  },
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
