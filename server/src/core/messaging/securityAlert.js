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
  SECONDARY_CONTACT_CHANGED: {
    subject: "Un contact de récupération a été modifié sur votre compte SwiftGoma",
    title: "Un contact de récupération a été modifié sur votre compte",
    sms: "un contact de récupération a été modifié sur votre compte",
  },
  SECONDARY_CONTACT_REMOVED: {
    subject: "Un contact de récupération a été retiré de votre compte SwiftGoma",
    title: "Un contact de récupération a été retiré de votre compte",
    sms: "un contact de récupération a été retiré de votre compte",
  },
  RECOVERY_REQUESTED: {
    subject: "Une récupération de votre compte SwiftGoma a été demandée",
    title:
      "Une récupération de votre compte a été demandée. Si ce n'est pas vous, connectez-vous et annulez-la dans les 24 heures",
    sms: "une récupération de votre compte a été demandée, annulable pendant 24 h",
  },
  RECOVERY_COMPLETED: {
    subject: "Votre compte SwiftGoma a été récupéré avec un nouveau contact",
    title: "Votre compte a été récupéré avec un nouveau contact principal",
    sms: "votre compte a été récupéré avec un nouveau contact principal",
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
  PRIMARY_CONTACT_ADDED: {
    subject: "Un contact principal a été ajouté à votre compte SwiftGoma",
    title: "Un contact principal a été ajouté à votre compte",
    sms: "un contact principal a été ajouté à votre compte",
  },
  PRIMARY_CONTACT_CHANGED: {
    subject: "Votre contact principal SwiftGoma a été modifié",
    title: "Votre e-mail ou numéro principal a été modifié",
    sms: "votre e-mail ou numéro principal a été modifié",
  },
  ACCOUNT_DELETION_REQUESTED: {
    subject: "La suppression de votre compte SwiftGoma a été demandée",
    title:
      "La suppression de votre compte a été demandée. Reconnectez-vous dans les 30 jours pour l'annuler",
    sms: "la suppression de votre compte a été demandée, annulable en vous reconnectant pendant 30 jours",
  },
  ACCOUNT_DELETION_CANCELLED: {
    subject: "La suppression de votre compte SwiftGoma a été annulée",
    title: "La suppression de votre compte a été annulée",
    sms: "la suppression de votre compte a été annulée",
  },
  SUSPICIOUS_ACTIVITY_REPORTED: {
    subject: "Une activité suspecte a été signalée sur votre compte SwiftGoma",
    title:
      "Une activité suspecte a été signalée sur votre compte. Tous vos appareils ont été déconnectés et votre mot de passe a été supprimé",
    sms: "une activité suspecte a été signalée, vos appareils sont déconnectés et votre mot de passe supprimé",
  },
  DATA_EXPORT_REQUESTED: {
    subject: "Une copie de vos données SwiftGoma a été téléchargée",
    title: "Une copie de vos données a été téléchargée",
    sms: "une copie de vos données a été téléchargée",
  },
  ADMIN_SESSIONS_REVOKED: {
    subject: "Vos appareils ont été déconnectés de votre compte SwiftGoma",
    title: "Vos appareils ont été déconnectés par l'équipe SwiftGoma",
    sms: "vos appareils ont été déconnectés par l'équipe SwiftGoma",
  },
  ADMIN_ROLE_CHANGED: {
    subject: "Le type de votre compte SwiftGoma a été modifié",
    title: "Le type de votre compte a été modifié par l'équipe SwiftGoma",
    sms: "le type de votre compte a été modifié par l'équipe SwiftGoma",
  },
  ACCOUNT_UNLOCKED: {
    subject: "Votre compte SwiftGoma a été débloqué",
    title: "Votre compte a été débloqué par l'équipe SwiftGoma, vous pouvez vous reconnecter",
    sms: "votre compte a été débloqué par l'équipe SwiftGoma",
  },
  ADMIN_PASSWORD_RESET: {
    subject: "Votre mot de passe SwiftGoma a été supprimé par l'équipe",
    title:
      "Votre mot de passe a été supprimé par l'équipe SwiftGoma. Utilisez « Mot de passe oublié » pour en choisir un nouveau",
    sms: "votre mot de passe a été supprimé par l'équipe SwiftGoma, choisissez-en un nouveau",
  },
  ADMIN_TWO_FACTOR_RESET: {
    subject: "La double vérification de votre compte SwiftGoma a été réinitialisée",
    title:
      "La double vérification, les codes de secours et les empreintes ont été réinitialisés par l'équipe SwiftGoma",
    sms: "la double vérification de votre compte a été réinitialisée par l'équipe SwiftGoma",
  },
  ADMIN_PROFILE_MODERATED: {
    subject: "Votre profil SwiftGoma a été modifié par l'équipe",
    title: "Votre profil a été modifié par l'équipe SwiftGoma",
    sms: "votre profil a été modifié par l'équipe SwiftGoma",
  },
  ADMIN_CONTACT_UPDATED: {
    subject: "Votre contact principal SwiftGoma a été modifié par l'équipe",
    title: "Votre e-mail ou numéro principal a été modifié par l'équipe SwiftGoma",
    sms: "votre e-mail ou numéro principal a été modifié par l'équipe SwiftGoma",
  },
  ADMIN_DATA_EXPORTED: {
    subject: "Une copie de vos données SwiftGoma a été générée",
    title: "Une copie de vos données a été générée par l'équipe SwiftGoma sur demande",
    sms: "une copie de vos données a été générée par l'équipe SwiftGoma sur demande",
  },
  ADMIN_DELETION_FORCED: {
    subject: "Votre compte SwiftGoma a été supprimé",
    title: "Votre compte a été supprimé définitivement par l'équipe SwiftGoma",
    sms: "votre compte a été supprimé définitivement par l'équipe SwiftGoma",
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
