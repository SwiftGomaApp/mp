const { renderLayout, textFooter, styles, FONT, BRAND_COLOR } = require("./layout");
const { escapeHtml } = require("./escape");

function staffSetupTemplate({ name, email, setupUrl, expiresHours }) {
  const greeting = name ? `Bonjour ${escapeHtml(name)},` : "Bonjour,";

  const html = renderLayout({
    preheader: "Votre compte Support SwiftGoma a été créé",
    content: `
<p style="${styles.p}">${greeting}</p>
<p style="${styles.p}">Un compte Support SwiftGoma a été créé pour vous. Votre identifiant de connexion est <strong>${escapeHtml(email)}</strong>.</p>
<p style="${styles.p}"><a href="${escapeHtml(setupUrl)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:${BRAND_COLOR};color:#ffffff;font-family:${FONT};font-size:16px;font-weight:600;text-decoration:none;">Choisir mon mot de passe</a></p>
<p style="${styles.p}">Ce lien expire dans ${expiresHours} heures et ne peut servir qu'une fois.</p>
<p style="${styles.p}"><strong>Double vérification obligatoire.</strong> À votre première connexion, vous devrez l'activer avant d'accéder à quoi que ce soit : installez une application d'authentification sur votre téléphone, scannez le code affiché, puis conservez les codes de secours remis à l'activation. Vous ne pourrez pas la désactiver.</p>
<p style="${styles.muted}">Si vous n'attendiez pas ce message, ignorez-le et prévenez l'équipe SwiftGoma.</p>`,
  });

  const text = [
    name ? `Bonjour ${name},` : "Bonjour,",
    "",
    `Un compte Support SwiftGoma a été créé pour vous. Votre identifiant de connexion est ${email}.`,
    "",
    `Choisissez votre mot de passe : ${setupUrl}`,
    `Ce lien expire dans ${expiresHours} heures et ne peut servir qu'une fois.`,
    "",
    "Double vérification obligatoire : à votre première connexion, vous devrez l'activer avant d'accéder à quoi que ce soit. Installez une application d'authentification sur votre téléphone, scannez le code affiché, puis conservez les codes de secours remis à l'activation. Vous ne pourrez pas la désactiver.",
    "",
    "Si vous n'attendiez pas ce message, ignorez-le et prévenez l'équipe SwiftGoma.",
    textFooter(),
  ].join("\n");

  return { subject: "Votre compte Support SwiftGoma", html, text };
}

module.exports = { staffSetupTemplate };
