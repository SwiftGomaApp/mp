const { renderLayout, textFooter, styles } = require("./layout");
const { escapeHtml } = require("./escape");

function formatOtpCode(code) {
  return `${code}`;
}

const SAFETY_NOTE =
  "Ne partagez jamais ce code, pas même avec l'équipe SwiftGoma : nous ne vous le demanderons jamais.";

const GENERIC = {
  why: "Vous recevez cet e-mail parce qu'une action sur votre compte SwiftGoma nécessite une confirmation. Nous demandons ce code afin de nous assurer que la demande vient bien de vous et non d'une autre personne.",
  subject: "Votre code de confirmation SwiftGoma",
  preheader: (code) => `Votre code de confirmation : ${code}`,
  intro: "Voici votre code pour confirmer cette action sur votre compte :",
  ignore: "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.",
};

const COPY = {
  signup: {
    why: "Vous recevez cet e-mail parce que cette adresse a été utilisée pour créer un compte SwiftGoma. Avant d'ouvrir le compte, nous devons vérifier que cette adresse est bien la vôtre et que vous pouvez recevoir nos messages, par exemple pour suivre vos commandes ou récupérer l'accès à votre compte plus tard.",
    subject: "Bienvenue sur SwiftGoma : confirmez votre adresse",
    preheader: (code) => `Votre code pour finaliser votre inscription : ${code}`,
    intro:
      "Merci de rejoindre SwiftGoma, on est ravis de vous compter parmi nous ! Pour finaliser la création de votre compte, saisissez ce code dans l'application :",
    ignore:
      "Si vous n'avez pas essayé de créer un compte, aucune action n'est nécessaire : ignorez simplement cet e-mail.",
  },
  login: {
    why: "Vous recevez cet e-mail parce qu'une tentative de connexion a été faite sur votre compte SwiftGoma avec cette adresse. Votre compte est protégé par une vérification en deux temps : même avec le bon identifiant, le code ci-dessus est nécessaire pour entrer, ce qui empêche quelqu'un d'autre d'utiliser votre compte.",
    subject: "Votre code de connexion SwiftGoma",
    preheader: (code) => `Votre code de connexion : ${code}`,
    intro: "Content de vous revoir ! Voici le code à saisir pour vous connecter à votre compte :",
    ignore:
      "Si ce n'est pas vous qui essayez de vous connecter, ignorez cet e-mail et pensez à changer votre mot de passe par précaution.",
  },
  "password-reset": {
    why: "Vous recevez cet e-mail parce que quelqu'un, sans doute vous, a demandé à réinitialiser le mot de passe du compte SwiftGoma associé à cette adresse. Pour votre sécurité, nous ne modifions jamais un mot de passe sans avoir vérifié, grâce à ce code, que la demande vient du propriétaire du compte.",
    subject: "Réinitialisez votre mot de passe SwiftGoma",
    preheader: (code) => `Votre code de réinitialisation : ${code}`,
    intro:
      "Vous avez oublié votre mot de passe ? Pas de souci, cela arrive à tout le monde. Saisissez ce code pour en choisir un nouveau :",
    ignore:
      "Si vous n'avez pas demandé cette réinitialisation, ignorez cet e-mail : votre mot de passe actuel reste inchangé.",
  },
  "step-up": {
    why: "Vous recevez cet e-mail parce que vous (ou quelqu'un utilisant votre session) êtes sur le point d'effectuer une opération sensible sur votre compte SwiftGoma, comme modifier des informations de sécurité. Même connecté, nous redemandons une confirmation pour ces opérations, afin qu'une session laissée ouverte ne suffise pas à prendre le contrôle de votre compte.",
    subject: "Confirmez que c'est bien vous – SwiftGoma",
    preheader: (code) => `Code de vérification : ${code}`,
    intro:
      "Pour protéger votre compte, nous voulons nous assurer que c'est bien vous qui effectuez cette opération sensible. Saisissez ce code pour continuer :",
    ignore:
      "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail et sécurisez votre compte en changeant votre mot de passe.",
  },
  recovery: {
    why: "Vous recevez cet e-mail parce qu'une demande de récupération de compte SwiftGoma a été lancée et que cette adresse est enregistrée comme contact de secours du compte. Ce code permet de vérifier que vous avez bien accès à ce contact avant de poursuivre la récupération.",
    subject: "Récupération de votre compte SwiftGoma",
    preheader: (code) => `Votre code de récupération : ${code}`,
    intro:
      "Vous avez perdu l'accès à votre compte ? Nous sommes là pour vous aider à le récupérer. Voici le code à saisir pour prouver que ce contact vous appartient :",
    ignore:
      "Si vous n'avez pas lancé cette récupération, ignorez cet e-mail : personne ne pourra accéder à votre compte sans ce code.",
  },
  "recovery-contact": {
    why: "Vous recevez cet e-mail parce que, dans le cadre de la récupération d'un compte SwiftGoma, cette adresse a été proposée comme nouveau contact principal. Nous devons vérifier qu'elle vous appartient avant de la rattacher au compte, afin que personne ne puisse y associer une adresse qu'il ne contrôle pas.",
    subject: "Confirmez votre nouveau contact SwiftGoma",
    preheader: (code) => `Code pour confirmer votre nouveau contact : ${code}`,
    intro:
      "Vous y êtes presque ! Pour terminer la récupération de votre compte avec ce nouveau contact, saisissez ce code :",
    ignore: "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.",
  },
  "contact-verification": {
    why: "Vous recevez cet e-mail parce que cette adresse a été indiquée comme contact de secours pour un compte SwiftGoma. Tant que ce code n'est pas saisi, l'adresse n'est pas ajoutée : nous voulons être certains qu'elle appartient bien à la personne qui l'a renseignée.",
    subject: "Confirmez votre contact de secours SwiftGoma",
    preheader: (code) => `Code pour confirmer votre contact de secours : ${code}`,
    intro:
      "Vous êtes en train d'ajouter ce contact à votre compte SwiftGoma. Il nous aidera à vous aider si vous perdez un jour l'accès à votre compte. Saisissez ce code pour le confirmer :",
    ignore:
      "Si vous n'avez pas demandé cet ajout, ignorez cet e-mail : ce contact ne sera pas ajouté.",
  },
};

function otpTemplate({ name, code, expiresMinutes, purpose }) {
  const copy = COPY[purpose] || GENERIC;
  const greeting = name ? `Bonjour ${escapeHtml(name)},` : "Bonjour,";
  const displayCode = formatOtpCode(code);
  const minutes = `${expiresMinutes} minute${expiresMinutes > 1 ? "s" : ""}`;

  const html = renderLayout({
    preheader: copy.preheader(displayCode),
    content: `
<p style="${styles.p}">${greeting}</p>
<p style="${styles.p}">${copy.intro}</p>
<p style="${styles.code}">${escapeHtml(displayCode)}</p>
<p style="${styles.p}">Ce code expire dans ${minutes}.</p>
<p style="${styles.muted}">${copy.why}</p>
<p style="${styles.muted}">${SAFETY_NOTE} ${copy.ignore}</p>`,
  });

  const text = [
    name ? `Bonjour ${name},` : "Bonjour,",
    "",
    copy.intro,
    "",
    displayCode,
    "",
    `Ce code expire dans ${minutes}.`,
    "",
    copy.why,
    "",
    `${SAFETY_NOTE} ${copy.ignore}`,
    textFooter(),
  ].join("\n");

  return { subject: copy.subject, html, text };
}

module.exports = { otpTemplate, formatOtpCode };
