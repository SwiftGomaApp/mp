import { REQUEST_ID_HEADER } from "./constants";
import { CLIENT_ERROR_CODES } from "./error-codes";
import type { ErrorCode } from "./error-codes";

export type HeaderMap = Readonly<Record<string, string | undefined>>;

export interface FieldError {
  field: string;
  message: string;
}

export interface ApiErrorInit {
  code: ErrorCode;
  message: string;
  status?: number;
  details?: unknown;
  requestId?: string;
  cause?: unknown;
}

export interface ApiErrorSummary {
  name: string;
  code: ErrorCode;
  message: string;
  status: number | undefined;
  requestId: string | undefined;
}

export interface ErrorResponse {
  status: number;
  body: unknown;
  headers?: HeaderMap;
}

const BRAND = "__swiftgomaApiError";

const DEFAULT_MESSAGES = {
  NETWORK_ERROR: "Impossible de joindre le serveur. Vérifiez votre connexion.",
  TIMEOUT: "Le serveur met trop de temps à répondre. Veuillez réessayer.",
  NOT_AUTHENTICATED: "Vous devez vous connecter pour continuer.",
  UNKNOWN_ERROR: "Une erreur est survenue",
} as const;

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number | undefined;
  readonly details: unknown;
  readonly requestId: string | undefined;
  readonly cause: unknown;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = "ApiError";
    this.code = init.code;
    this.status = init.status;
    this.details = init.details;
    this.requestId = init.requestId;
    this.cause = init.cause;
    Object.defineProperty(this, BRAND, { value: true });
  }

  toJSON(): ApiErrorSummary {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      status: this.status,
      requestId: this.requestId,
    };
  }
}

export class BadRequestError extends ApiError {
  override name: string = "BadRequestError";
}

export class UnauthorizedError extends ApiError {
  override name: string = "UnauthorizedError";
}

export class ForbiddenError extends ApiError {
  override name: string = "ForbiddenError";
}

export class NotFoundError extends ApiError {
  override name: string = "NotFoundError";
}

export class ConflictError extends ApiError {
  override name: string = "ConflictError";
}

export class ServerError extends ApiError {
  override name: string = "ServerError";
}

export class NetworkError extends ApiError {
  override name: string = "NetworkError";
}

export class TimeoutError extends ApiError {
  override name: string = "TimeoutError";
}

export class NotAuthenticatedError extends ApiError {
  override name: string = "NotAuthenticatedError";
}

export class ValidationError extends ApiError {
  override name: string = "ValidationError";
  readonly fields: readonly FieldError[];

  constructor(init: ApiErrorInit & { fields?: readonly FieldError[] }) {
    super(init);
    this.fields = init.fields ?? [];
  }

  get messagesByField(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const { field, message } of this.fields) {
      if (!(field in result)) result[field] = message;
    }
    return result;
  }
}

export class TooManyRequestsError extends ApiError {
  override name: string = "TooManyRequestsError";
  readonly retryAfterSeconds: number | undefined;

  constructor(init: ApiErrorInit & { retryAfterSeconds?: number }) {
    super(init);
    this.retryAfterSeconds = init.retryAfterSeconds;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readHeader(headers: HeaderMap | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const wanted = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === wanted) return headers[key];
  }
  return undefined;
}

interface ParsedBody {
  code: string;
  message: string;
  details: unknown;
  requestId: string | undefined;
}

function parseErrorBody(body: unknown): ParsedBody | null {
  if (!isRecord(body) || !isRecord(body.error)) return null;
  const { code, message, details, requestId } = body.error;
  if (typeof code !== "string" || typeof message !== "string") return null;
  return {
    code,
    message,
    details,
    requestId: typeof requestId === "string" ? requestId : undefined,
  };
}

function readFields(details: unknown): FieldError[] {
  if (!Array.isArray(details)) return [];
  const fields: FieldError[] = [];
  for (const item of details) {
    if (isRecord(item) && typeof item.field === "string" && typeof item.message === "string") {
      fields.push({ field: item.field, message: item.message });
    }
  }
  return fields;
}

function readRetryAfterSeconds(details: unknown, headers?: HeaderMap): number | undefined {
  if (isRecord(details)) {
    const seconds = details.retryAfterSeconds;
    if (typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0) {
      return Math.ceil(seconds);
    }
  }

  const header = readHeader(headers, "retry-after")?.trim();
  if (!header) return undefined;

  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);

  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(Math.ceil((date - Date.now()) / 1000), 0);
}

export function createApiError(response: ErrorResponse, cause?: unknown): ApiError {
  const parsed = parseErrorBody(response.body);
  const init: ApiErrorInit = {
    code: parsed?.code ?? CLIENT_ERROR_CODES.UNKNOWN_ERROR,
    message: parsed?.message ?? DEFAULT_MESSAGES.UNKNOWN_ERROR,
    status: response.status,
    details: parsed?.details,
    requestId: parsed?.requestId ?? readHeader(response.headers, REQUEST_ID_HEADER),
    cause,
  };

  switch (response.status) {
    case 400:
      return new BadRequestError(init);
    case 401:
      return new UnauthorizedError(init);
    case 403:
      return new ForbiddenError(init);
    case 404:
      return new NotFoundError(init);
    case 409:
      return new ConflictError(init);
    case 422:
      return new ValidationError({ ...init, fields: readFields(parsed?.details) });
    case 429:
      return new TooManyRequestsError({
        ...init,
        retryAfterSeconds: readRetryAfterSeconds(parsed?.details, response.headers),
      });
    default:
      return response.status >= 500 ? new ServerError(init) : new ApiError(init);
  }
}

export function createNetworkError(cause?: unknown): NetworkError {
  return new NetworkError({
    code: CLIENT_ERROR_CODES.NETWORK_ERROR,
    message: DEFAULT_MESSAGES.NETWORK_ERROR,
    cause,
  });
}

export function createTimeoutError(cause?: unknown): TimeoutError {
  return new TimeoutError({
    code: CLIENT_ERROR_CODES.TIMEOUT,
    message: DEFAULT_MESSAGES.TIMEOUT,
    cause,
  });
}

export function createNotAuthenticatedError(): NotAuthenticatedError {
  return new NotAuthenticatedError({
    code: CLIENT_ERROR_CODES.NOT_AUTHENTICATED,
    message: DEFAULT_MESSAGES.NOT_AUTHENTICATED,
  });
}

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<string, unknown>)[BRAND] === true
  );
}

export function hasErrorCode(value: unknown, code: ErrorCode | readonly ErrorCode[]): boolean {
  if (!isApiError(value)) return false;
  return Array.isArray(code) ? code.includes(value.code) : value.code === code;
}
