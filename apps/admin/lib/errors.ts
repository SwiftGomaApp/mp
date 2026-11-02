import { ValidationError, isApiError } from "swiftgoma-mp-auth";

export interface ErrorInfo {
  message: string;
  code?: string;
  status?: number;
  requestId?: string;
  fields?: Record<string, string>;
  details?: unknown;
}

/** Reads the server error shape `{ error: { code, message, details?, requestId } }`. */
export function describeError(error: unknown): ErrorInfo {
  if (isApiError(error)) {
    return {
      message: error.message,
      code: error.code,
      status: error.status,
      requestId: error.requestId,
      fields: error instanceof ValidationError ? error.messagesByField : undefined,
      details: error.details,
    };
  }
  if (error instanceof Error) return { message: error.message };
  return { message: "Une erreur est survenue" };
}

export function hasCode(error: unknown, ...codes: string[]): boolean {
  return isApiError(error) && codes.includes(error.code);
}
