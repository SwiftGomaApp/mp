const jwt = require("jsonwebtoken");
const { getConfig } = require("../../config/env.config");
const { randomToken, sha256 } = require("../crypto/crypto");

const ALGORITHM = "HS256";
const ISSUER = "swiftgoma-api";
const AUDIENCE = "swiftgoma-app";

function signAccessToken({ userId, role, sessionId }) {
  const { accessSecret, accessTtlSeconds } = getConfig().auth;

  return jwt.sign({ role, sid: sessionId }, accessSecret, {
    algorithm: ALGORITHM,
    subject: userId,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: accessTtlSeconds,
  });
}

function verifyAccessToken(token) {
  const payload = jwt.verify(token, getConfig().auth.accessSecret, {
    algorithms: [ALGORITHM],
    issuer: ISSUER,
    audience: AUDIENCE,
  });

  return { userId: payload.sub, role: payload.role, sessionId: payload.sid };
}

function generateRefreshToken() {
  const { refreshTtlDays } = getConfig().auth;
  const token = randomToken(48);

  return {
    token,
    hash: sha256(token),
    expiresAt: new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000),
  };
}

function hashRefreshToken(token) {
  return sha256(token);
}

module.exports = { signAccessToken, verifyAccessToken, generateRefreshToken, hashRefreshToken };
