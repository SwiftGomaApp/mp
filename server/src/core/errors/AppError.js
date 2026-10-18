class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message = "Requête invalide", details, code = "BAD_REQUEST") {
    return new AppError(400, code, message, details);
  }
  static unauthorized(message = "Authentification requise", code = "UNAUTHORIZED") {
    return new AppError(401, code, message);
  }
  static forbidden(message = "Accès refusé", code = "FORBIDDEN") {
    return new AppError(403, code, message);
  }
  static notFound(message = "Ressource introuvable", code = "NOT_FOUND") {
    return new AppError(404, code, message);
  }
  static conflict(message = "Conflit avec l'état actuel de la ressource", code = "CONFLICT") {
    return new AppError(409, code, message);
  }
  static tooManyRequests(
    message = "Trop de requêtes, veuillez réessayer plus tard",
    code = "TOO_MANY_REQUESTS",
  ) {
    return new AppError(429, code, message);
  }
  static internal(message = "Une erreur est survenue", code = "INTERNAL_ERROR") {
    return new AppError(500, code, message);
  }
}

module.exports = { AppError };
