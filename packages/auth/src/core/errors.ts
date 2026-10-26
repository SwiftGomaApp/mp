import { ERROR_CODES, type ErrorCode } from "./constants";

export interface FieldError {
  field: string;
  message: string;
}

export interface ApiErrorInit {
  message: string;
  code: ErrorCode;
  status?: number | null;
  details?: unknown;
  requestId?: string | undefined;
  cause?: unknown;
}

export interface RawApiResponse {
  status: number;
  data?: unknown;
  headers?: Record<string, unknown> | undefined;
  cause?: unknown;
}

const MESSAGES = {
  network: "Impossible de joindre le serveur, vérifiez votre connexion internet",
  timeout: "Le serveur met trop de temps à répondre, veuillez réessayer",
  badRequest: "Requête invalide",
  unauthorized: "Authentification requise",
  forbidden: "Accès refusé",
  notFound: "Ressource introuvable",
  conflict: "Conflit avec l'état actuel de la ressource",
  validation: "Données invalides",
  tooManyRequests: "Trop de requêtes, veuillez réessayer plus tard",
  server: "Une erreur est survenue",
} as const;

export class ApiError extends Error {
  override name = "ApiError";
  readonly code: ErrorCode;
  readonly status: number | null;
  readonly details: unknown;
  readonly requestId: string | undefined;

  constructor(init: ApiErrorInit) {
    super(init.message, init.cause === undefined ? undefined : { cause: init.cause });
    this.code = init.code;
    this.status = init.status ?? null;
    this.details = init.details;
    this.requestId = init.requestId;
  }

  is(...codes: ErrorCode[]): boolean {
    return codes.includes(this.code);
  }
}

export class NetworkError extends ApiError {
  override name = "NetworkError";

  constructor(init: { message?: string; cause?: unknown } = {}) {
    super({
      message: init.message ?? MESSAGES.network,
      code: ERROR_CODES.NETWORK_ERROR,
      status: null,
      cause: init.cause,
    });
  }
}

export class TimeoutError extends ApiError {
  override name = "TimeoutError";

  constructor(init: { message?: string; cause?: unknown } = {}) {
    super({
      message: init.message ?? MESSAGES.timeout,
      code: ERROR_CODES.TIMEOUT,
      status: null,
      cause: init.cause,
    });
  }
}

export class UnauthorizedError extends ApiError {
  override name = "UnauthorizedError";
}

export class ForbiddenError extends ApiError {
  override name = "ForbiddenError";
}

export class NotFoundError extends ApiError {
  override name = "NotFoundError";
}

export class ConflictError extends ApiError {
  override name = "ConflictError";
}

export class ServerError extends ApiError {
  override name = "ServerError";
}

export class ValidationError extends ApiError {
  override name = "ValidationError";

  get fields(): FieldError[] {
    if (!Array.isArray(this.details)) return [];
    const fields: FieldError[] = [];
    for (const item of this.details) {
      if (isRecord(item) && typeof item.field === "string" && typeof item.message === "string") {
        fields.push({ field: item.field, message: item.message });
      }
    }
    return fields;
  }
}

export class TooManyRequestsError extends ApiError {
  override name = "TooManyRequestsError";
  readonly retryAfterSeconds: number | undefined;

  constructor(init: ApiErrorInit & { retryAfterSeconds?: number | undefined }) {
    super(init);
    this.retryAfterSeconds = init.retryAfterSeconds;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readErrorBody(data: unknown) {
  const error = isRecord(data) ? data.error : undefined;
  if (!isRecord(error)) {
    return { code: undefined, message: undefined, details: undefined, requestId: undefined };
  }
  return {
    code: asString(error.code),
    message: asString(error.message),
    details: error.details,
    requestId: asString(error.requestId),
  };
}

function readRetryAfter(
  details: unknown,
  headers: Record<string, unknown> | undefined,
): number | undefined {
  if (isRecord(details)) {
    const value = details.retryAfterSeconds;
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  }
  if (headers) {
    for (const [name, raw] of Object.entries(headers)) {
      if (name.toLowerCase() !== "retry-after") continue;
      const seconds = Number(raw);
      if (Number.isFinite(seconds) && seconds >= 0) return seconds;
    }
  }
  return undefined;
}

function defaultCode(status: number): ErrorCode {
  if (status === 400) return ERROR_CODES.BAD_REQUEST;
  if (status === 401) return ERROR_CODES.UNAUTHORIZED;
  if (status === 403) return ERROR_CODES.FORBIDDEN;
  if (status === 404) return ERROR_CODES.NOT_FOUND;
  if (status === 409) return ERROR_CODES.CONFLICT;
  if (status === 422) return ERROR_CODES.VALIDATION_ERROR;
  if (status === 429) return ERROR_CODES.TOO_MANY_REQUESTS;
  if (status >= 500) return ERROR_CODES.INTERNAL_ERROR;
  return ERROR_CODES.UNKNOWN_ERROR;
}

function defaultMessage(status: number): string {
  if (status === 400) return MESSAGES.badRequest;
  if (status === 401) return MESSAGES.unauthorized;
  if (status === 403) return MESSAGES.forbidden;
  if (status === 404) return MESSAGES.notFound;
  if (status === 409) return MESSAGES.conflict;
  if (status === 422) return MESSAGES.validation;
  if (status === 429) return MESSAGES.tooManyRequests;
  return MESSAGES.server;
}

export function createApiError(response: RawApiResponse): ApiError {
  const { status } = response;
  const body = readErrorBody(response.data);
  const init: ApiErrorInit = {
    message: body.message ?? defaultMessage(status),
    code: body.code ?? defaultCode(status),
    status,
    details: body.details,
    requestId: body.requestId,
    cause: response.cause,
  };

  if (status === 401) return new UnauthorizedError(init);
  if (status === 403) return new ForbiddenError(init);
  if (status === 404) return new NotFoundError(init);
  if (status === 409) return new ConflictError(init);
  if (status === 422) return new ValidationError(init);
  if (status === 429) {
    return new TooManyRequestsError({
      ...init,
      retryAfterSeconds: readRetryAfter(body.details, response.headers),
    });
  }
  if (status >= 500) return new ServerError(init);
  return new ApiError(init);
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

export function hasErrorCode(value: unknown, ...codes: ErrorCode[]): boolean {
  return isApiError(value) && value.is(...codes);
}
