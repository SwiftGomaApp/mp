const { escapeHtml } = require("../../../core/mail/templates/escape");
const links = require("../services/links");
const tracking = require("../services/tracking.service");
const { unsubscribeEmail } = require("../services/unsubscribe.service");

function page({ title, message, action }) {
  const form = action
    ? `<form method="post" action=""><button type="submit" style="margin-top:8px;padding:14px 28px;border:0;border-radius:8px;background:#FF4F00;color:#fff;font-size:16px;font-weight:600;cursor:pointer;">${escapeHtml(action)}</button></form>`
    : "";

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:48px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111;">
<main style="max-width:480px;margin:0 auto;">
<h1 style="font-size:22px;margin:0 0 16px;">${escapeHtml(title)}</h1>
<p style="font-size:16px;line-height:24px;margin:0 0 16px;color:#374151;">${escapeHtml(message)}</p>
${form}
</main></body></html>`;
}

const html = (res, status, content) =>
  res.status(status).set("Cache-Control", "no-store").type("html").send(content);

const invalidLink = (res) =>
  html(
    res,
    404,
    page({ title: "Lien invalide", message: "Ce lien est invalide ou a expiré." }),
  );

function unsubscribePayload(token) {
  const payload = links.verify(token);
  return payload?.t === "u" && payload.e ? payload : null;
}

function unsubscribePage(req, res) {
  if (!unsubscribePayload(req.params.token)) return invalidLink(res);
  return html(
    res,
    200,
    page({
      title: "Se désabonner",
      message: "Confirmez-vous ne plus vouloir recevoir les actualités SwiftGoma par e-mail ?",
      action: "Me désabonner",
    }),
  );
}

async function unsubscribe(req, res, next) {
  try {
    const payload = unsubscribePayload(req.params.token);
    if (!payload) return invalidLink(res);

    await unsubscribeEmail({ email: payload.e, campaignId: payload.c, recipientId: payload.r });
    return html(
      res,
      200,
      page({
        title: "Désabonnement confirmé",
        message:
          "Vous ne recevrez plus nos actualités par e-mail. Les messages importants sur votre compte continueront d'être envoyés.",
      }),
    );
  } catch (err) {
    return next(err);
  }
}

async function openPixel(req, res, next) {
  try {
    await tracking.recordOpen(req.params.token, req.get("user-agent"));
    res
      .status(200)
      .set({ "Content-Type": "image/gif", "Cache-Control": "no-store, max-age=0" })
      .send(tracking.PIXEL);
  } catch (err) {
    next(err);
  }
}

async function click(req, res, next) {
  try {
    const target = await tracking.resolveClick(req.params.token, req.get("user-agent"));
    if (!target) return invalidLink(res);
    res.set("Cache-Control", "no-store").redirect(302, target);
  } catch (err) {
    next(err);
  }
}

module.exports = { unsubscribePage, unsubscribe, openPixel, click };
