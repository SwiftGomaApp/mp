const { getConfig } = require("../../../config/env.config");
const { escapeHtml } = require("./escape");

const FONT =
  "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "'Geist Mono', 'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace";
const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@600&display=swap";

const BRAND_COLOR = "#FF4F00";
const ADDRESS = "Goma, République démocratique du Congo, 234 Commune de Goma, rue Zangi Butondo";

const styles = {
  p: `margin:0 0 20px 0;font-family:${FONT};font-size:16px;line-height:24px;color:#111111;`,
  muted: `margin:0;font-family:${FONT};font-size:14px;line-height:22px;color:#6b7280;`,
  code: `margin:0 0 24px 0;font-family:${MONO};font-size:34px;line-height:40px;font-weight:600;letter-spacing:2px;color:#111111;`,
};

function renderLayout({ preheader = "", content }) {
  const { mail } = getConfig();
  const year = new Date().getFullYear();

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<link href="${FONT_URL}" rel="stylesheet">
<style>
@import url('${FONT_URL}');
body { margin:0; padding:0; background:#ffffff; }
@media only screen and (max-width:620px) {
  .container { width:100% !important; }
  .px { padding-left:20px !important; padding-right:20px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background:#ffffff;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
<tr>
<td align="center" style="padding:32px 16px;">
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
<tr>
<td class="px" style="padding:0 0 32px 0;">
<img src="${escapeHtml(mail.logoUrl)}" width="${mail.logoWidth}" height="${mail.logoHeight}" alt="SwiftGoma" style="display:block;width:${mail.logoWidth}px;height:${mail.logoHeight}px;max-width:100%;border:0;outline:none;text-decoration:none;">
</td>
</tr>
<tr>
<td class="px" style="padding:0;">
${content}
</td>
</tr>
<tr>
<td class="px" style="padding:32px 0 0 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="border-top:1px solid #e5e7eb;font-size:0;line-height:0;height:1px;">&nbsp;</td></tr>
</table>
<p style="margin:20px 0 4px 0;font-family:${FONT};font-size:14px;line-height:22px;color:#6b7280;">
Besoin d'aide ? <a href="mailto:${escapeHtml(mail.supportEmail)}" style="color:#6b7280;text-decoration:underline;">${escapeHtml(mail.supportEmail)}</a>
&nbsp;·&nbsp;
<a href="${escapeHtml(mail.privacyUrl)}" style="color:#6b7280;text-decoration:underline;">Politique de confidentialité</a>
</p>
<p style="margin:0 0 4px 0;font-family:${FONT};font-size:14px;line-height:22px;color:#6b7280;">${escapeHtml(ADDRESS)}</p>
<p style="margin:0;font-family:${FONT};font-size:14px;line-height:22px;color:#6b7280;">© ${year} SwiftGoma</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

function textFooter() {
  const { mail } = getConfig();
  return [
    "",
    "--",
    `Besoin d'aide ? ${mail.supportEmail}`,
    `Politique de confidentialité : ${mail.privacyUrl}`,
    ADDRESS,
    `© ${new Date().getFullYear()} SwiftGoma`,
  ].join("\n");
}

module.exports = { renderLayout, textFooter, styles, FONT, MONO, BRAND_COLOR };
