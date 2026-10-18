const { renderLayout, textFooter, styles, FONT, BRAND_COLOR } = require("./layout");
const { escapeHtml } = require("./escape");

const TIME_ZONE = "Africa/Lubumbashi";

function formatDate(date) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatHour(date) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function row(label, value) {
  return `
<tr>
<td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-family:${FONT};font-size:14px;line-height:20px;color:#6b7280;width:38%;">${label}</td>
<td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-family:${FONT};font-size:14px;line-height:20px;color:#111111;font-weight:500;">${escapeHtml(value)}</td>
</tr>`;
}

function loginAlertTemplate({
  name,
  deviceName,
  location,
  country,
  date = new Date(),
  activityUrl,
}) {
  const greeting = name ? `Bonjour ${escapeHtml(name)},` : "Bonjour,";
  const day = formatDate(date);
  const hour = formatHour(date);

  const html = renderLayout({
    preheader: "Nouvelle connexion détectée sur votre compte SwiftGoma",
    content: `
<p style="${styles.p}">${greeting}</p>
<p style="${styles.p}">Nous avons détecté une nouvelle connexion à votre compte SwiftGoma. Voici les détails :</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;border:1px solid #e5e7eb;border-radius:8px;border-collapse:separate;">
${row("Appareil", deviceName)}
${row("Lieu", location)}
${row("Pays", country)}
${row("Date", day)}
${row("Heure", hour)}
</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;">
<tr>
<td align="center" bgcolor="${BRAND_COLOR}" style="border-radius:8px;">
<a href="${escapeHtml(activityUrl)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Vérifier l'activité</a>
</td>
</tr>
</table>
<p style="${styles.muted}">Si c'était vous, vous n'avez rien à faire. Sinon, cliquez sur le bouton ci-dessus pour vérifier l'activité de votre compte et le sécuriser. L'équipe SwiftGoma ne vous demandera jamais votre mot de passe ni vos codes.</p>`,
  });

  const text = [
    name ? `Bonjour ${name},` : "Bonjour,",
    "",
    "Nous avons détecté une nouvelle connexion à votre compte SwiftGoma. Voici les détails :",
    "",
    `Appareil : ${deviceName}`,
    `Lieu : ${location}`,
    `Pays : ${country}`,
    `Date : ${day}`,
    `Heure : ${hour}`,
    "",
    `Vérifier l'activité : ${activityUrl}`,
    "",
    "Si c'était vous, vous n'avez rien à faire. Sinon, vérifiez l'activité de votre compte et sécurisez-le.",
    textFooter(),
  ].join("\n");

  return { subject: "Nouvelle connexion à votre compte SwiftGoma", html, text };
}

module.exports = { loginAlertTemplate };
