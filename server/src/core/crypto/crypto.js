const crypto = require("crypto");

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function generateOtp(digits = 6) {
  return crypto
    .randomInt(0, 10 ** digits)
    .toString()
    .padStart(digits, "0");
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function hmacSha256(value, secret) {
  return crypto.createHmac("sha256", secret).update(String(value)).digest("hex");
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = { randomToken, generateOtp, sha256, hmacSha256, safeEqual };
