const crypto = require("crypto");
const { getConfig } = require("../../config/env.config");
const { safeEqual } = require("../crypto/crypto");

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;
const WINDOW = 1;

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(input) {
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of String(input).replace(/=+$/, "").toUpperCase()) {
    const idx = BASE32.indexOf(char);
    if (idx === -1) throw new Error("Invalid base32 secret");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function codeForStep(secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = crypto.createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  return (binary % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

function currentStep(now = Date.now()) {
  return Math.floor(now / 1000 / STEP_SECONDS);
}

function verifyTotp({ secret, code, lastUsedStep = null, now = Date.now() }) {
  const submitted = String(code ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(submitted)) return null;

  const step = currentStep(now);
  for (let offset = -WINDOW; offset <= WINDOW; offset++) {
    const candidate = step + offset;
    if (lastUsedStep !== null && candidate <= lastUsedStep) continue;
    if (safeEqual(codeForStep(secret, candidate), submitted)) return candidate;
  }
  return null;
}

function buildOtpauthUri({ secret, accountName }) {
  const issuer = getConfig().auth.totpIssuer;
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

function encryptSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getConfig().auth.totpKey, iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((b) => b.toString("base64url")).join(".");
}

function decryptSecret(payload) {
  const [iv, tag, encrypted] = String(payload)
    .split(".")
    .map((p) => Buffer.from(p, "base64url"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", getConfig().auth.totpKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

module.exports = {
  generateTotpSecret,
  verifyTotp,
  buildOtpauthUri,
  encryptSecret,
  decryptSecret,
};
