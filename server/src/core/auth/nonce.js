const crypto = require("crypto");
const { AppError } = require("../errors/AppError");
const { getRedis } = require("../cache/redis");

const key = (nonce) => `oauth-nonce:${crypto.createHash("sha256").update(nonce).digest("hex")}`;

async function issueNonce() {
  const nonce = crypto.randomBytes(32).toString("base64url");
  await getRedis().set(key(nonce), "1", "EX", 600);
  return nonce;
}

async function consumeNonce(nonce, code) {
  if (typeof nonce !== "string" || (await getRedis().del(key(nonce))) !== 1) {
    throw AppError.unauthorized("Nonce invalide ou expiré", code);
  }
}

module.exports = { issueNonce, consumeNonce };
