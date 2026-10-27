import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "../src/core/constants";
import {
  ApiError,
  ConflictError,
  ForbiddenError,
  NetworkError,
  NotFoundError,
  ServerError,
  TimeoutError,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
  createApiError,
  hasErrorCode,
  isApiError,
} from "../src/core/errors";

const body = (code: string, message: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message, requestId: "req-1", ...extra },
});

describe("createApiError", () => {
  it.each([
    [401, UnauthorizedError],
    [403, ForbiddenError],
    [404, NotFoundError],
    [409, ConflictError],
    [422, ValidationError],
    [429, TooManyRequestsError],
    [500, ServerError],
    [503, ServerError],
  ])("maps status %i to the matching class", (status, expected) => {
    const error = createApiError({ status });
    expect(error).toBeInstanceOf(expected);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(status);
  });

  it("keeps other client errors as a plain ApiError", () => {
    const error = createApiError({ status: 400 });
    expect(error.constructor).toBe(ApiError);
    expect(error.code).toBe(ERROR_CODES.BAD_REQUEST);
  });

  it("reads the code, message, details and request id from the server body", () => {
    const error = createApiError({
      status: 401,
      data: body("TOKEN_EXPIRED", "Votre session a expiré", { details: { a: 1 } }),
    });
    expect(error.code).toBe("TOKEN_EXPIRED");
    expect(error.message).toBe("Votre session a expiré");
    expect(error.details).toEqual({ a: 1 });
    expect(error.requestId).toBe("req-1");
    expect(error.name).toBe("UnauthorizedError");
  });

  it.each([
    undefined,
    null,
    "<html>Bad gateway</html>",
    { error: "oops" },
    { error: { code: 42 } },
    [],
  ])("falls back to a default code and message for an unusable body (%j)", (data) => {
    const error = createApiError({ status: 502, data });
    expect(error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    expect(error.message).toBe("Une erreur est survenue");
    expect(error.requestId).toBeUndefined();
  });

  it("uses a sensible default code for each status", () => {
    expect(createApiError({ status: 401 }).code).toBe(ERROR_CODES.UNAUTHORIZED);
    expect(createApiError({ status: 403 }).code).toBe(ERROR_CODES.FORBIDDEN);
    expect(createApiError({ status: 404 }).code).toBe(ERROR_CODES.NOT_FOUND);
    expect(createApiError({ status: 409 }).code).toBe(ERROR_CODES.CONFLICT);
    expect(createApiError({ status: 422 }).code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(createApiError({ status: 429 }).code).toBe(ERROR_CODES.TOO_MANY_REQUESTS);
    expect(createApiError({ status: 418 }).code).toBe(ERROR_CODES.UNKNOWN_ERROR);
  });
});

describe("validation errors", () => {
  it("list the invalid fields", () => {
    const error = createApiError({
      status: 422,
      data: body("VALIDATION_ERROR", "Données invalides", {
        details: [
          { field: "email", message: "Adresse invalide" },
          { field: "phone", message: "Numéro invalide" },
        ],
      }),
    });
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).fields).toEqual([
      { field: "email", message: "Adresse invalide" },
      { field: "phone", message: "Numéro invalide" },
    ]);
  });

  it("ignore malformed entries and missing details", () => {
    const withJunk = createApiError({
      status: 422,
      data: body("VALIDATION_ERROR", "x", {
        details: [{ field: "a" }, 3, null, { field: "b", message: "ok" }],
      }),
    }) as ValidationError;
    expect(withJunk.fields).toEqual([{ field: "b", message: "ok" }]);
    expect((createApiError({ status: 422 }) as ValidationError).fields).toEqual([]);
  });
});

describe("rate limit errors", () => {
  it("read the wait time from the details", () => {
    const error = createApiError({
      status: 429,
      data: body("OTP_COOLDOWN", "Patientez", { details: { retryAfterSeconds: 42 } }),
    }) as TooManyRequestsError;
    expect(error.retryAfterSeconds).toBe(42);
    expect(error.code).toBe("OTP_COOLDOWN");
  });

  it("fall back to the Retry-After header, whatever its case", () => {
    const error = createApiError({
      status: 429,
      data: body("TOO_MANY_REQUESTS", "Trop de requêtes"),
      headers: { "Retry-After": "30" },
    }) as TooManyRequestsError;
    expect(error.retryAfterSeconds).toBe(30);
  });

  it("do not guess when there is no usable wait time", () => {
    const none = createApiError({ status: 429 }) as TooManyRequestsError;
    const date = createApiError({
      status: 429,
      headers: { "retry-after": "Wed, 21 Oct 2026 07:28:00 GMT" },
    }) as TooManyRequestsError;
    const negative = createApiError({
      status: 429,
      data: body("X", "x", { details: { retryAfterSeconds: -5 } }),
    }) as TooManyRequestsError;
    expect(none.retryAfterSeconds).toBeUndefined();
    expect(date.retryAfterSeconds).toBeUndefined();
    expect(negative.retryAfterSeconds).toBeUndefined();
  });
});

describe("connection errors", () => {
  it("have no status and a French message by default", () => {
    const network = new NetworkError();
    const timeout = new TimeoutError();
    expect(network.status).toBeNull();
    expect(network.code).toBe(ERROR_CODES.NETWORK_ERROR);
    expect(network.message).toMatch(/Impossible de joindre le serveur/);
    expect(timeout.status).toBeNull();
    expect(timeout.code).toBe(ERROR_CODES.TIMEOUT);
    expect(timeout.message).toMatch(/trop de temps/);
  });

  it("keep the original error as the cause", () => {
    const cause = new Error("ECONNREFUSED");
    const error = new NetworkError({ cause });
    expect(error.cause).toBe(cause);
    expect(new NetworkError().cause).toBeUndefined();
  });
});

describe("helpers", () => {
  it("recognise API errors and nothing else", () => {
    expect(isApiError(new NetworkError())).toBe(true);
    expect(isApiError(createApiError({ status: 500 }))).toBe(true);
    expect(isApiError(new Error("x"))).toBe(false);
    expect(isApiError(null)).toBe(false);
    expect(isApiError("ApiError")).toBe(false);
  });

  it("match error codes", () => {
    const error = createApiError({ status: 400, data: body("OTP_INVALID", "Code invalide") });
    expect(error.is("OTP_INVALID")).toBe(true);
    expect(error.is("OTP_COOLDOWN", "OTP_INVALID")).toBe(true);
    expect(error.is("OTP_COOLDOWN")).toBe(false);
    expect(hasErrorCode(error, "OTP_INVALID")).toBe(true);
    expect(hasErrorCode(new Error("x"), "OTP_INVALID")).toBe(false);
    expect(hasErrorCode(undefined, "OTP_INVALID")).toBe(false);
  });

  it("behave like normal errors", () => {
    const error = new ApiError({ message: "boom", code: "X" });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ApiError");
    expect(error.stack).toContain("boom");
  });
});
