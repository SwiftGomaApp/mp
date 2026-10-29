const { getConfig } = require("../../../config/env.config");
const { renderLayout, textFooter, styles } = require("../../../core/mail/templates/layout");
const { escapeHtml } = require("../../../core/mail/templates/escape");
const links = require("./links");

const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;
const HREF = /href=(["'])(https?:\/\/[^"']+)\1/gi;

function variables(name) {
  const full = String(name ?? "").trim();
  return { name: full, firstName: full.split(/\s+/)[0] ?? "" };
}

function fill(template, vars, { html = false } = {}) {
  return String(template ?? "").replace(PLACEHOLDER, (_match, key) => {
    const value = vars[key] ?? "";
    return html ? escapeHtml(value) : value;
  });
}

function trackLinks(html, { campaignId, recipientId }) {
  return html.replace(HREF, (_match, quote, url) => {
    const target = url.replace(/&amp;/g, "&");
    const token = links.sign({ t: "c", c: campaignId, r: recipientId, u: target });
    return `href=${quote}${links.clickUrl(token)}${quote}`;
  });
}

function htmlToText(html) {
  return String(html ?? "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Builds one recipient's email: personalised text, tracked links, an open pixel, a visible
 * unsubscribe link and the one-click unsubscribe headers. A preview carries no tracking.
 */
function composeCampaignEmail({ campaign, recipient, preview = false }) {
  const vars = variables(recipient.name);
  const unsubscribeUrl = links.unsubscribeUrl(
    links.sign({ t: "u", e: recipient.email, r: recipient.id, c: campaign.id }),
  );

  let body = fill(campaign.html, vars, { html: true });
  if (!preview) body = trackLinks(body, { campaignId: campaign.id, recipientId: recipient.id });

  const pixel = preview
    ? ""
    : `<img src="${links.openUrl(links.sign({ t: "o", c: campaign.id, r: recipient.id }))}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;">`;

  const footer = `<p style="${styles.muted}">Vous recevez cet e-mail car vous avez accepté de recevoir les actualités SwiftGoma. <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">Se désabonner</a></p>`;

  const html = renderLayout({
    preheader: fill(campaign.preheader, vars),
    content: `${body}\n<div style="height:24px;line-height:24px;">&nbsp;</div>\n${footer}${pixel}`,
  });

  const text = [
    fill(campaign.text || htmlToText(campaign.html), vars),
    "",
    `Se désabonner : ${unsubscribeUrl}`,
    textFooter(),
  ].join("\n");

  const subject = `${preview ? "[TEST] " : ""}${fill(campaign.subject, vars)}`;
  const { supportEmail } = getConfig().mail;

  return {
    subject,
    html,
    text,
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>, <mailto:${supportEmail}?subject=unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

module.exports = { composeCampaignEmail, fill, variables, htmlToText };
