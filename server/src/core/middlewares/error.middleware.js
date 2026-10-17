const { z } = require("zod");
const { AppError } = require("../errors/AppError");

z.config(z.locales.fr());

function notFoundHandler(req, res, next) {
  next(AppError.notFound("Route introuvable", "ROUTE_NOT_FOUND"));
}

function normalizeError(err) {
  if (err instanceof AppError) return err;

  if (err?.name === "ZodError" && Array.isArray(err.issues)) {
    const details = err.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
    return new AppError(422, "VALIDATION_ERROR", "Données invalides", details);
  }

  if (err?.type === "entity.parse.failed") {
    return new AppError(400, "INVALID_JSON", "Le corps de la requête n'est pas un JSON valide");
  }

  if (err?.type === "entity.too.large") {
    return new AppError(413, "PAYLOAD_TOO_LARGE", "Le corps de la requête est trop volumineux");
  }

  if (err?.message === "Not allowed by CORS") {
    return new AppError(403, "CORS_NOT_ALLOWED", "Origine non autorisée");
  }

  if (err?.name === "TokenExpiredError") {
    return new AppError(401, "TOKEN_EXPIRED", "Votre session a expiré, veuillez vous reconnecter");
  }
  if (err?.name === "JsonWebTokenError" || err?.name === "NotBeforeError") {
    return new AppError(401, "TOKEN_INVALID", "Session invalide, veuillez vous reconnecter");
  }

  if (typeof err?.code === "string" && /^P\d{4}$/.test(err.code)) {
    if (err.code === "P2002") return new AppError(409, "ALREADY_EXISTS", "Cet élément existe déjà");
    if (err.code === "P2025") return new AppError(404, "NOT_FOUND", "Ressource introuvable");
    if (err.code === "P2003")
      return new AppError(409, "RELATION_CONFLICT", "Conflit avec une ressource liée");
  }

  if (Number.isInteger(err?.status) && err.status >= 400 && err.status < 500) {
    return new AppError(err.status, "REQUEST_ERROR", "Requête invalide");
  }

  return null;
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const known = normalizeError(err);
  const status = known ? known.status : 500;

  if (status >= 500) {
    console.error(`[${req.id}] ${req.method} ${req.originalUrl}`, err);
  }

  res.status(status).json({
    error: {
      code: known ? known.code : "INTERNAL_ERROR",
      message: known && status < 500 ? known.message : "Une erreur est survenue",
      ...(known?.details ? { details: known.details } : {}),
      requestId: req.id,
    },
  });
}

module.exports = { notFoundHandler, errorHandler };
