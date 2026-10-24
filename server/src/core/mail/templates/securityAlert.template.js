const { renderLayout, textFooter, styles, FONT, BRAND_COLOR } = require("./layout");
const { escapeHtml } = require("./escape");
const { securityAlertInfo } = require("../../messaging/securityAlert");

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

function securityAlertTemplate({ name, type, date = new Date(), activityUrl }) {
  const info = securityAlertInfo(type);
  const greeting = name ? `Bonjour ${escapeHtml(name)},` : "Bonjour,";
  const day = formatDate(date);
  const hour = formatHour(date);

  const html = renderLayout({
    preheader: info.title,
    content: `
<p style="${styles.p}">${greeting}</p>
<p style="${styles.p}">${escapeHtml(info.title)}, le ${escapeHtml(day)} à ${escapeHtml(hour)}.</p>
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
    `${info.title}, le ${day} à ${hour}.`,
    "",
    `Vérifier l'activité : ${activityUrl}`,
    "",
    "Si c'était vous, vous n'avez rien à faire. Sinon, vérifiez l'activité de votre compte et sécurisez-le.",
    textFooter(),
  ].join("\n");

  return { subject: info.subject, html, text };
}

module.exports = { securityAlertTemplate };
