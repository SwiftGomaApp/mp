import { describe, expect, it, vi } from "vitest";
import {
  ApiError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NetworkError,
  NotAuthenticatedError,
  NotFoundError,
  ServerError,
  TimeoutError,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
  createApiError,
  createNetworkError,
  createNotAuthenticatedError,
  createTimeoutError,
  hasErrorCode,
  isApiError,
} from "../src/index";

const body = (code: string, message = "Message du serveur", extra: object = {}): object => ({
  error: { code, message, requestId: "req-1", ...extra },
});

describe("createApiError: choosing the class", () => {
  it.each([
    [400, BadRequestError],
    [401, UnauthorizedError],
    [403, ForbiddenError],
    [404, NotFoundError],
    [409, ConflictError],
    [422, ValidationError],
    [429, TooManyRequestsError],
    [500, ServerError],
    [503, ServerError],
  ])("maps HTTP %i to the matching class", (status, expected) => {
    const error = createApiError({ status, body: body("SOME_CODE") });
    expect(error).toBeInstanceOf(expected);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(status);
  });

  it("falls back to ApiError for other statuses", () => {
    const error = createApiError({ status: 413, body: body("PAYLOAD_TOO_LARGE") });
    expect(error.constructor).toBe(ApiError);
    expect(error.code).toBe("PAYLOAD_TOO_LARGE");
  });
});

describe("createApiError: reading the server answer", () => {
  it("keeps the code, the message and the request id", () => {
    const error = createApiError({
      status: 400,
      body: body("OTP_INVALID", "Code invalide ou expiré"),
    });
    expect(error.code).toBe("OTP_INVALID");
    expect(error.message).toBe("Code invalide ou expiré");
    expect(error.requestId).toBe("req-1");
    expect(error.name).toBe("BadRequestError");
  });

  it("uses the X-Request-Id header when the body has none", () => {
    const error = createApiError({
      status: 500,
      body: { error: { code: "INTERNAL_ERROR", message: "Une erreur est survenue" } },
      headers: { "X-Request-Id": "from-header" },
    });
    expect(error.requestId).toBe("from-header");
  });

  it("keeps the details and the underlying error", () => {
    const cause = new Error("axios failure");
    const error = createApiError(
      {
        status: 403,
        body: body("RECOVERY_WAITING", "Patientez", {
          details: { availableAt: "2026-11-01T10:00:00Z" },
        }),
      },
      cause,
    );
    expect(error.details).toEqual({ availableAt: "2026-11-01T10:00:00Z" });
    expect(error.cause).toBe(cause);
  });

  it.each([
    ["an HTML page from a proxy", "<html>Bad gateway</html>"],
    ["nothing", undefined],
    ["null", null],
    ["a body without an error object", { message: "oops" }],
    ["an error without a code", { error: { message: "oops" } }],
    ["an error with a wrong type", { error: { code: 42, message: "oops" } }],
  ])("copes with %s", (_name, answer) => {
    const error = createApiError({ status: 502, body: answer });
    expect(error).toBeInstanceOf(ServerError);
    expect(error.code).toBe("UNKNOWN_ERROR");
    expect(error.message).toBe("Une erreur est survenue");
    expect(error.status).toBe(502);
  });
});

describe("ValidationError", () => {
  const answer = body("VALIDATION_ERROR", "Données invalides", {
    details: [
      { field: "email", message: "E-mail invalide" },
      { field: "email", message: "Deuxième message" },
      { field: "device.deviceId", message: "Trop court" },
      { field: 12, message: "ignored" },
      "ignored",
    ],
  });

  it("lists the fields the server refused and ignores malformed entries", () => {
    const error = createApiError({ status: 422, body: answer }) as ValidationError;
    expect(error.fields).toEqual([
      { field: "email", message: "E-mail invalide" },
      { field: "email", message: "Deuxième message" },
      { field: "device.deviceId", message: "Trop court" },
    ]);
  });

  it("gives the first message of each field for forms", () => {
    const error = createApiError({ status: 422, body: answer }) as ValidationError;
    expect(error.messagesByField).toEqual({
      email: "E-mail invalide",
      "device.deviceId": "Trop court",
    });
  });

  it("has no fields when the details are missing", () => {
    const error = createApiError({
      status: 422,
      body: body("VALIDATION_ERROR"),
    }) as ValidationError;
    expect(error.fields).toEqual([]);
    expect(error.messagesByField).toEqual({});
  });
});

describe("TooManyRequestsError", () => {
  const limited = (extra: object, headers?: Record<string, string>): TooManyRequestsError =>
    createApiError({
      status: 429,
      body: body("TOO_MANY_REQUESTS", "Trop", extra),
      headers,
    }) as TooManyRequestsError;

  it("reads the delay from the details first", () => {
    const error = limited({ details: { retryAfterSeconds: 42 } }, { "retry-after": "10" });
    expect(error.retryAfterSeconds).toBe(42);
  });

  it("reads the Retry-After header in seconds", () => {
    expect(limited({}, { "Retry-After": "30" }).retryAfterSeconds).toBe(30);
  });

  it("reads the Retry-After header as a date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-29T12:00:00Z"));
    try {
      const later = limited({}, { "retry-after": "Thu, 29 Oct 2026 12:01:30 GMT" });
      const past = limited({}, { "retry-after": "Thu, 29 Oct 2026 11:00:00 GMT" });
      expect(later.retryAfterSeconds).toBe(90);
      expect(past.retryAfterSeconds).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rounds up fractions and ignores nonsense", () => {
    expect(limited({ details: { retryAfterSeconds: 4.2 } }).retryAfterSeconds).toBe(5);
    expect(limited({ details: { retryAfterSeconds: -3 } }).retryAfterSeconds).toBeUndefined();
    expect(limited({ details: { retryAfterSeconds: "soon" } }).retryAfterSeconds).toBeUndefined();
    expect(limited({}, { "retry-after": "tomorrow-ish" }).retryAfterSeconds).toBeUndefined();
    expect(limited({}, { "retry-after": "  " }).retryAfterSeconds).toBeUndefined();
    expect(limited({}).retryAfterSeconds).toBeUndefined();
  });
});

describe("errors the package raises itself", () => {
  it("describes a network failure", () => {
    const cause = new Error("ECONNRESET");
    const error = createNetworkError(cause);
    expect(error).toBeInstanceOf(NetworkError);
    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.status).toBeUndefined();
    expect(error.cause).toBe(cause);
    expect(error.message).toContain("connexion");
  });

  it("describes a timeout", () => {
    const error = createTimeoutError();
    expect(error).toBeInstanceOf(TimeoutError);
    expect(error.code).toBe("TIMEOUT");
    expect(error.status).toBeUndefined();
  });

  it("describes a missing session", () => {
    const error = createNotAuthenticatedError();
    expect(error).toBeInstanceOf(NotAuthenticatedError);
    expect(error.code).toBe("NOT_AUTHENTICATED");
  });
});

describe("helpers", () => {
  it("recognises API errors, including one from another copy of the package", async () => {
    const error = createApiError({ status: 400, body: body("OTP_INVALID") });
    expect(isApiError(error)).toBe(true);
    expect(isApiError(new Error("plain"))).toBe(false);
    expect(isApiError(null)).toBe(false);
    expect(isApiError("OTP_INVALID")).toBe(false);

    vi.resetModules();
    const otherCopy = await import("../src/index");
    expect(error instanceof otherCopy.ApiError).toBe(false);
    expect(otherCopy.isApiError(error)).toBe(true);
  });

  it("checks one code or a list of codes", () => {
    const error = createApiError({ status: 400, body: body("OTP_INVALID") });
    expect(hasErrorCode(error, "OTP_INVALID")).toBe(true);
    expect(hasErrorCode(error, ["TWO_FACTOR_INVALID", "OTP_INVALID"])).toBe(true);
    expect(hasErrorCode(error, "OTP_COOLDOWN")).toBe(false);
    expect(hasErrorCode(new Error("OTP_INVALID"), "OTP_INVALID")).toBe(false);
  });

  it("summarises an error for logs without the request body or the cause", () => {
    const error = createApiError(
      { status: 400, body: body("OTP_INVALID", "Code invalide") },
      new Error("secret"),
    );
    expect(JSON.parse(JSON.stringify(error))).toEqual({
      name: "BadRequestError",
      code: "OTP_INVALID",
      message: "Code invalide",
      status: 400,
      requestId: "req-1",
    });
  });

  it("is a real Error with a stack and a readable name", () => {
    const error = createApiError({ status: 404, body: body("NOT_FOUND") });
    expect(error.stack).toContain("Error");
    expect(String(error)).toBe("NotFoundError: Message du serveur");
  });
});
