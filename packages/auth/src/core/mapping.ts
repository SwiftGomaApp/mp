import { DEFAULT_CHALLENGE_TTL_SECONDS } from "./challenge";
import { ERROR_CODES } from "./constants";
import { ApiError } from "./errors";
import type { RefreshResult, StartSessionInput } from "./session";
import type {
  AuthUser,
  CodeRequested,
  CurrentUser,
  LogoutAllResult,
  ResendResult,
  TwoFactorSetup,
} from "./types";

type Dict = Record<string, unknown>;

export type ParsedLogin =
  | { kind: "session"; user: AuthUser; isNewDevice: boolean; tokens: StartSessionInput }
  | { kind: "challenge"; enrollment: boolean; token: string; expiresIn: number };

function isRecord(value: unknown): value is Dict {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type SessionLogin = Extract<ParsedLogin, { kind: "session" }>;

export function unexpectedResponse(): ApiError {
  return new ApiError({
    message: "Réponse inattendue du serveur",
    code: ERROR_CODES.UNKNOWN_ERROR,
  });
}

function readRecord(value: unknown): Dict {
  if (!isRecord(value)) throw unexpectedResponse();
  return value;
}

function readUser(value: unknown): AuthUser {
  const user = readRecord(value);
  if (typeof user.id !== "string") throw unexpectedResponse();
  return user as unknown as AuthUser;
}

function readTokens(data: Dict): StartSessionInput {
  return {
    accessToken: typeof data.accessToken === "string" ? data.accessToken : null,
    refreshToken: typeof data.refreshToken === "string" ? data.refreshToken : null,
    expiresIn: typeof data.expiresIn === "number" ? data.expiresIn : undefined,
  };
}

export function parseLogin(value: unknown): ParsedLogin {
  const data = readRecord(value);

  if (data.twoFactorRequired === true) {
    if (typeof data.challengeToken !== "string" || data.challengeToken === "") {
      throw unexpectedResponse();
    }
    return {
      kind: "challenge",
      enrollment: data.enrollment === true,
      token: data.challengeToken,
      expiresIn:
        typeof data.expiresIn === "number" ? data.expiresIn : DEFAULT_CHALLENGE_TTL_SECONDS,
    };
  }
  return {
    kind: "session",
    user: readUser(data.user),
    isNewDevice: data.isNewDevice === true,
    tokens: readTokens(data),
  };
}

export function parseSignupVerified(value: unknown): { user: AuthUser; tokens: StartSessionInput } {
  const data = readRecord(value);
  return { user: readUser(data.user), tokens: readTokens(data) };
}

export function parseCodeRequested(value: unknown): CodeRequested {
  const { method, target, expiresMinutes } = readRecord(value);
  if (method !== "EMAIL" && method !== "PHONE") throw unexpectedResponse();
  if (typeof target !== "string") throw unexpectedResponse();
  if (typeof expiresMinutes !== "string" && typeof expiresMinutes !== "number") {
    throw unexpectedResponse();
  }
  return {
    method: method === "EMAIL" ? "EMAIL" : "PHONE",
    target,
    expiresMinutes: String(expiresMinutes),
  };
}

export function parseResend(value: unknown): ResendResult {
  const { message } = readRecord(value);
  if (typeof message !== "string") throw unexpectedResponse();
  return { message };
}

export function parseLogoutAll(value: unknown): LogoutAllResult {
  const { revoked } = readRecord(value);
  if (typeof revoked !== "number") throw unexpectedResponse();
  return { revoked };
}

export function parseMe(value: unknown): CurrentUser {
  return readUser(readRecord(value).user) as CurrentUser;
}

export function parseRefresh(value: unknown): RefreshResult {
  const data = readRecord(value);
  return {
    accessToken: typeof data.accessToken === "string" ? data.accessToken : null,
    refreshToken: typeof data.refreshToken === "string" ? data.refreshToken : null,
    expiresIn: typeof data.expiresIn === "number" ? data.expiresIn : undefined,
  };
}

export function parseVerifiedLogin(value: unknown): SessionLogin {
  const parsed = parseLogin(value);
  if (parsed.kind !== "session") throw unexpectedResponse();
  return parsed;
}

export function parseTwoFactorSetup(value: unknown): TwoFactorSetup {
  const { secret, otpauthUri } = readRecord(value);
  if (typeof secret !== "string" || typeof otpauthUri !== "string") throw unexpectedResponse();
  return { secret, otpauthUri };
}

export function parseEnrollment(value: unknown): { login: SessionLogin; backupCodes: string[] } {
  const data = readRecord(value);
  const login = parseVerifiedLogin(data);
  const { backupCodes } = data;
  if (
    !Array.isArray(backupCodes) ||
    !backupCodes.every((c): c is string => typeof c === "string")
  ) {
    throw unexpectedResponse();
  }
  return { login, backupCodes };
}

export function parseNonce(value: unknown): string {
  const { nonce } = readRecord(value);
  if (typeof nonce !== "string" || nonce === "") throw unexpectedResponse();
  return nonce;
}
