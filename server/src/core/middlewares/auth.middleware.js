const { getConfig } = require("../../config/env.config");
const { verifyAccessToken } = require("../auth/tokens");
const { isSessionRevoked } = require("../auth/revocation");
const { ACCESS_COOKIE } = require("../auth/cookies");
const { AppError } = require("../errors/AppError");
const { getPrisma } = require("../db/prisma");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function extractToken(req) {
  const [scheme, bearer] = (req.headers.authorization || "").split(" ");
  if (scheme?.toLowerCase() === "bearer" && bearer) return { token: bearer, source: "bearer" };

  const cookie = req.cookies?.[ACCESS_COOKIE];
  if (cookie) return { token: cookie, source: "cookie" };

  return null;
}

function assertTrustedOrigin(req) {
  if (SAFE_METHODS.has(req.method)) return;

  const origin = req.headers.origin;
  if (!origin || !getConfig().corsOrigins.includes(origin)) {
    throw AppError.forbidden("Origine non autorisée", "CORS_NOT_ALLOWED");
  }
}

async function authenticate(req, res, next) {
  try {
    const found = extractToken(req);
    if (!found) throw AppError.unauthorized();

    if (found.source === "cookie") assertTrustedOrigin(req);

    const auth = verifyAccessToken(found.token);
    if (await isSessionRevoked(auth.sessionId)) {
      throw AppError.unauthorized("Session expirée, veuillez vous reconnecter", "SESSION_REVOKED");
    }

    req.auth = { ...auth, source: found.source };
    next();
  } catch (err) {
    next(err);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth) return next(AppError.unauthorized());
    if (!roles.includes(req.auth.role)) return next(AppError.forbidden());
    next();
  };
}

function requireApproved() {
  return async (req, res, next) => {
    try {
      if (!req.auth) throw AppError.unauthorized();
      const user = await getPrisma().user.findUnique({
        where: { id: req.auth.userId },
        select: { verificationStatus: true },
      });
      if (user?.verificationStatus !== "APPROVED") {
        throw AppError.forbidden(
          "Votre dossier doit être approuvé avant de continuer",
          "VERIFICATION_REQUIRED",
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { authenticate, requireRole, requireApproved, assertTrustedOrigin };
