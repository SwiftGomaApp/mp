import { isApiError } from "./errors";

/**
 * Something the package did that an app may want in its logs. The detail never holds a token,
 * a code, a password or a request body: only names, error codes, statuses and delays.
 */
export interface AuthLogEvent {
  level: "debug" | "warn";
  /** For example `refresh.failed`, `session.ended`, `token.scheduled`, `request.retried`. */
  name: string;
  detail?: Record<string, string | number | boolean | null>;
}

export type AuthLogger = (event: AuthLogEvent) => void;

/** A logger that cannot break the package: whatever the app does in it is contained. */
export function createSafeLogger(logger: AuthLogger | undefined): AuthLogger {
  if (!logger) return () => undefined;
  return (event) => {
    try {
      logger(event);
    } catch {
      // The logger is the app's business.
    }
  };
}

/** The part of an error that is safe to log. */
export function describeError(error: unknown): { code: string; status: number | null } {
  if (isApiError(error)) return { code: error.code, status: error.status ?? null };
  return { code: "UNKNOWN_ERROR", status: null };
}
