class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message = "Bad request", details, code = "BAD_REQUEST") {
    return new AppError(400, code, message, details);
  }
  static unauthorized(message = "Authentication required", code = "UNAUTHORIZED") {
    return new AppError(401, code, message);
  }
  static forbidden(message = "Access denied", code = "FORBIDDEN") {
    return new AppError(403, code, message);
  }
  static notFound(message = "Resource not found", code = "NOT_FOUND") {
    return new AppError(404, code, message);
  }
  static conflict(message = "Conflict", code = "CONFLICT") {
    return new AppError(409, code, message);
  }
  static tooManyRequests(message = "Too many requests", code = "TOO_MANY_REQUESTS") {
    return new AppError(429, code, message);
  }
  static internal(message = "Something went wrong", code = "INTERNAL_ERROR") {
    return new AppError(500, code, message);
  }
}

module.exports = { AppError };
