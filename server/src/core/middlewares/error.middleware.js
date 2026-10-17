const { AppError } = require("../errors/AppError");

function notFoundHandler(req, res, next) {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`, "ROUTE_NOT_FOUND"));
}

function normalizeError(err) {
  if (err instanceof AppError) return err;

  if (err?.name === "ZodError" && Array.isArray(err.issues)) {
    const details = err.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
    return new AppError(422, "VALIDATION_ERROR", "Invalid input", details);
  }

  if (err?.type === "entity.parse.failed") {
    return new AppError(400, "INVALID_JSON", "Request body is not valid JSON");
  }

  if (err?.type === "entity.too.large") {
    return new AppError(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
  }

  if (err?.message === "Not allowed by CORS") {
    return new AppError(403, "CORS_NOT_ALLOWED", "Origin not allowed");
  }

  if (err?.name === "TokenExpiredError") {
    return new AppError(401, "TOKEN_EXPIRED", "Token has expired");
  }
  if (err?.name === "JsonWebTokenError" || err?.name === "NotBeforeError") {
    return new AppError(401, "TOKEN_INVALID", "Invalid token");
  }

  if (typeof err?.code === "string" && /^P\d{4}$/.test(err.code)) {
    if (err.code === "P2002") return new AppError(409, "ALREADY_EXISTS", "Resource already exists");
    if (err.code === "P2025") return new AppError(404, "NOT_FOUND", "Resource not found");
    if (err.code === "P2003")
      return new AppError(409, "RELATION_CONFLICT", "Related resource conflict");
  }

  if (Number.isInteger(err?.status) && err.status >= 400 && err.status < 500) {
    return new AppError(err.status, "REQUEST_ERROR", err.message);
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
      message: known && status < 500 ? known.message : "Something went wrong",
      ...(known?.details ? { details: known.details } : {}),
      requestId: req.id,
    },
  });
}

module.exports = { notFoundHandler, errorHandler };
