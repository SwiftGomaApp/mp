const jwt = require("jsonwebtoken");
const { getConfig } = require("../../config/env.config");
const { verifyAccessToken } = require("../auth/tokens");
const { isSessionRevoked } = require("../auth/revocation");
const { ACCESS_COOKIE } = require("../auth/cookies");
const { getPrisma } = require("../db/prisma");
const { authConfig } = require("../../features/auth/config/auth.config");

const BLOCKED_STATUSES = new Set(["SUSPENDED", "BANNED", "DELETED"]);

function reject(code, message = "Non autorisé") {
  const err = new Error(message);
  err.data = { code };
  return err;
}

function readCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1 || part.slice(0, index).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

function extractToken(handshake) {
  const token = handshake.auth?.token;
  if (typeof token === "string" && token) return { token, source: "token" };

  const cookie = readCookie(handshake.headers.cookie, ACCESS_COOKIE);
  if (cookie) return { token: cookie, source: "cookie" };

  return null;
}

async function verifySocketToken(token) {
  let auth;
  try {
    auth = verifyAccessToken(token);
  } catch (err) {
    throw reject(err.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "UNAUTHORIZED");
  }

  if (await isSessionRevoked(auth.sessionId)) {
    throw reject("SESSION_REVOKED", "Session expirée, veuillez vous reconnecter");
  }

  const { exp } = jwt.decode(token);
  return { ...auth, expiresAt: exp * 1000 };
}

async function assertAccountAllowed(auth) {
  const user = await getPrisma().user.findUnique({
    where: { id: auth.userId },
    select: { status: true, totp: { select: { confirmedAt: true } } },
  });

  if (!user || BLOCKED_STATUSES.has(user.status)) {
    throw reject("ACCOUNT_BLOCKED", "Compte indisponible");
  }
  if (authConfig.twoFactorRequiredRoles.includes(auth.role) && !user.totp?.confirmedAt) {
    throw reject("TWO_FACTOR_REQUIRED", "La double vérification doit être activée");
  }
}

async function authenticateSocket(socket, next) {
  try {
    const found = extractToken(socket.handshake);
    if (!found) throw reject("UNAUTHORIZED");

    if (found.source === "cookie") {
      const origin = socket.handshake.headers.origin;
      if (!origin || !getConfig().corsOrigins.includes(origin)) {
        throw reject("ORIGIN_NOT_ALLOWED", "Origine non autorisée");
      }
    }

    const auth = await verifySocketToken(found.token);
    await assertAccountAllowed(auth);

    socket.data.auth = auth;
    next();
  } catch (err) {
    next(err.data ? err : reject("UNAVAILABLE", "Service indisponible"));
  }
}

module.exports = { authenticateSocket, verifySocketToken };
