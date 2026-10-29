const crypto = require("crypto");
const { getConfig } = require("../../../config/env.config");
const { hmacSha256, safeEqual } = require("../../../core/crypto/crypto");

function secret() {
  const { marketing, auth } = getConfig();
  return marketing.linkSecret || hmacSha256("marketing-links", auth.accessSecret);
}

function signature(body) {
  return crypto.createHmac("sha256", secret()).update(body).digest("base64url");
}

/** Signed, tamper-proof token for links that live inside emails (open, click, unsubscribe). */
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${signature(body)}`;
}

function verify(token) {
  const [body, provided, ...extra] = String(token ?? "").split(".");
  if (!body || !provided || extra.length) return null;
  if (!safeEqual(provided, signature(body))) return null;

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
}

const base = () => `${getConfig().apiBaseUrl.replace(/\/$/, "")}/api/v1/marketing/p`;

module.exports = {
  sign,
  verify,
  unsubscribeUrl: (token) => `${base()}/u/${token}`,
  openUrl: (token) => `${base()}/o/${token}`,
  clickUrl: (token) => `${base()}/c/${token}`,
};
