const { renderLayout, textFooter, styles } = require("./layout");
const { escapeHtml } = require("./escape");

function formatOtpCode(code) {
  return `${code}`;
}

function otpTemplate({ name, code, expiresMinutes }) {
  const greeting = name ? `Bonjour ${escapeHtml(name)},` : "Bonjour,";
  const displayCode = formatOtpCode(code);
  const minutes = `${expiresMinutes} minute${expiresMinutes > 1 ? "s" : ""}`;

  const html = renderLayout({
    preheader: `Votre code de confirmation : ${displayCode}`,
    content: `
<p style="${styles.p}">${greeting}</p>
<p style="${styles.p}">Voici votre code pour confirmer cette action sur votre compte :</p>
<p style="${styles.code}">${escapeHtml(displayCode)}</p>
<p style="${styles.p}">Ce code expire dans ${minutes}.</p>
<p style="${styles.muted}">Ne partagez jamais ce code. L'équipe SwiftGoma ne vous le demandera jamais. Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer cet e-mail.</p>`,
  });

  const text = [
    name ? `Bonjour ${name},` : "Bonjour,",
    "",
    "Voici votre code pour confirmer cette action sur votre compte :",
    "",
    displayCode,
    "",
    `Ce code expire dans ${minutes}.`,
    "",
    "Ne partagez jamais ce code. L'équipe SwiftGoma ne vous le demandera jamais. Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer cet e-mail.",
    textFooter(),
  ].join("\n");

  return { subject: "Votre code de confirmation SwiftGoma", html, text };
}

module.exports = { otpTemplate, formatOtpCode };
