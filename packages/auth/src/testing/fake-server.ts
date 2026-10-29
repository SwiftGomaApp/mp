import { AxiosError, AxiosHeaders } from "axios";
import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import type { Platform, Role } from "../core/constants";
import type { AuthUser } from "../core/types";

/** One request the fake server received. */
export interface FakeRequest {
  method: string;
  /** Relative to the API prefix, for example `/auth/login/password`. */
  path: string;
  body: unknown;
}

export interface FakeUserInput {
  email?: string;
  phone?: string;
  password?: string;
  name?: string;
  role?: Role;
  /** The user must pass the second step (code `123456`) after signing in. */
  twoFactor?: boolean;
}

export interface FakeAuthServer {
  /** Give it to `createAuth({ transport })`. */
  transport: AxiosAdapter;
  readonly requests: readonly FakeRequest[];
  /** The code every confirmation, sign-in and second-step prompt accepts. */
  readonly code: string;
  /** Registers a user who can sign in. */
  addUser(input: FakeUserInput): AuthUser;
  /** Every access token handed out so far now answers 401 TOKEN_EXPIRED. */
  expireAccessTokens(): void;
  /** Every session is revoked, as if the user signed out everywhere. */
  revokeSessions(): void;
  /** While offline, every request fails like a lost connection. */
  setOffline(offline: boolean): void;
}

interface FakeUser extends AuthUser {
  password?: string;
  twoFactor: boolean;
}

interface FakeSession {
  id: string;
  userId: string;
  deviceId: string;
  deviceName: string | null;
  platform: Platform;
  refreshToken: string;
  previousRefreshToken: string | null;
  revoked: boolean;
  createdAt: string;
}

interface Reply {
  status: number;
  data?: unknown;
}

class HttpFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const ACCESS_TTL_SECONDS = 900;
const CODE = "123456";

const asRecord = (value: unknown): Record<string, any> =>
  typeof value === "object" && value !== null ? (value as Record<string, any>) : {};

/**
 * A stand-in for the SwiftGoma auth API that keeps everything in memory. It answers like the
 * real server for sign-up, sign-in, refresh with rotation and reuse detection, `me`, logout and
 * devices, so an app can test its screens without a network.
 */
export function createFakeAuthServer(): FakeAuthServer {
  const requests: FakeRequest[] = [];
  const users: FakeUser[] = [];
  const sessions: FakeSession[] = [];
  const pending = new Map<string, { name: string; role: Role }>();
  const challenges = new Map<string, { userId: string; device: Record<string, any> }>();
  const accessTokens = new Map<string, string>(); // token -> session id
  const expired = new Set<string>();
  const cookieJar: { access: string | null; refresh: string | null } = {
    access: null,
    refresh: null,
  };
  let offline = false;
  let counter = 0;
  const next = (prefix: string): string => `${prefix}-${(counter += 1)}`;

  const publicUser = (u: FakeUser): AuthUser => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    status: u.status,
  });

  function addUser(input: FakeUserInput, status: AuthUser["status"] = "ACTIVE"): FakeUser {
    const user: FakeUser = {
      id: next("user"),
      name: input.name ?? "Test User",
      email: input.email ?? null,
      phone: input.phone ?? null,
      role: input.role ?? "BUYER",
      status,
      password: input.password,
      twoFactor: input.twoFactor ?? false,
    };
    users.push(user);
    return user;
  }

  const findUser = (body: Record<string, any>): FakeUser | undefined =>
    users.find((u) => (body.email ? u.email === body.email : u.phone === body.phone));

  function openSession(user: FakeUser, device: Record<string, any>, extra: object = {}): Reply {
    const known = sessions.some((s) => s.userId === user.id && s.deviceId === device.deviceId);
    for (const s of sessions) {
      if (s.userId === user.id && s.deviceId === device.deviceId) s.revoked = true;
    }
    const session: FakeSession = {
      id: next("session"),
      userId: user.id,
      deviceId: String(device.deviceId),
      deviceName: device.deviceName ?? null,
      platform: device.platform,
      refreshToken: next("refresh"),
      previousRefreshToken: null,
      revoked: false,
      createdAt: new Date().toISOString(),
    };
    sessions.push(session);
    const accessToken = next("access");
    accessTokens.set(accessToken, session.id);

    const base = {
      user: publicUser(user),
      isNewDevice: !known,
      expiresIn: ACCESS_TTL_SECONDS,
      ...extra,
    };
    if (device.platform === "WEB") {
      cookieJar.access = accessToken;
      cookieJar.refresh = session.refreshToken;
      return { status: 200, data: base };
    }
    return { status: 200, data: { ...base, accessToken, refreshToken: session.refreshToken } };
  }

  function signInOrChallenge(user: FakeUser, device: Record<string, any>): Reply {
    if (!user.twoFactor) return openSession(user, device);
    const challengeToken = `challenge-${next("c")}`.padEnd(40, "x");
    challenges.set(challengeToken, { userId: user.id, device });
    return { status: 202, data: { twoFactorRequired: true, challengeToken, expiresIn: 300 } };
  }

  function authenticate(config: InternalAxiosRequestConfig): FakeSession {
    const header = config.headers.get("Authorization")?.toString() ?? "";
    const token = header.startsWith("Bearer ")
      ? header.slice(7)
      : config.withCredentials
        ? cookieJar.access
        : null;
    if (!token) throw new HttpFailure(401, "UNAUTHORIZED", "Non authentifié");
    if (expired.has(token)) throw new HttpFailure(401, "TOKEN_EXPIRED", "Votre session a expiré");
    const sessionId = accessTokens.get(token);
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) throw new HttpFailure(401, "TOKEN_INVALID", "Session invalide");
    if (session.revoked) throw new HttpFailure(401, "SESSION_REVOKED", "Session expirée");
    return session;
  }

  const userOf = (session: FakeSession): FakeUser => users.find((u) => u.id === session.userId)!;

  function refresh(config: InternalAxiosRequestConfig, body: Record<string, any>): Reply {
    const fromBody = typeof body.refreshToken === "string";
    const token = fromBody ? body.refreshToken : cookieJar.refresh;
    if (!token) throw new HttpFailure(401, "REFRESH_TOKEN_MISSING", "Session expirée");

    const session = sessions.find(
      (s) => s.refreshToken === token || s.previousRefreshToken === token,
    );
    if (!session) throw new HttpFailure(401, "REFRESH_TOKEN_INVALID", "Session invalide");
    if (session.previousRefreshToken === token) {
      session.revoked = true; // an old token used again means it was stolen
      throw new HttpFailure(401, "TOKEN_REUSED", "Session invalide");
    }
    if (session.revoked) throw new HttpFailure(401, "SESSION_REVOKED", "Session expirée");

    session.previousRefreshToken = session.refreshToken;
    session.refreshToken = next("refresh");
    const accessToken = next("access");
    accessTokens.set(accessToken, session.id);
    void config;

    if (!fromBody) {
      cookieJar.access = accessToken;
      cookieJar.refresh = session.refreshToken;
      return { status: 200, data: { expiresIn: ACCESS_TTL_SECONDS } };
    }
    return {
      status: 200,
      data: { accessToken, refreshToken: session.refreshToken, expiresIn: ACCESS_TTL_SECONDS },
    };
  }

  function handle(
    config: InternalAxiosRequestConfig,
    path: string,
    body: Record<string, any>,
  ): Reply {
    const method = String(config.method).toLowerCase();
    const route = `${method} ${path}`;

    switch (route) {
      case "post /auth/signup/email":
      case "post /auth/signup/phone": {
        const key = body.email ?? body.phone;
        if (findUser(body)) throw new HttpFailure(409, "ACCOUNT_EXISTS", "Un compte existe déjà");
        pending.set(key, { name: body.name, role: body.role });
        return {
          status: 201,
          data: { method: body.email ? "EMAIL" : "PHONE", target: key, expiresMinutes: 10 },
        };
      }
      case "post /auth/signup/resend":
        return { status: 200, data: { message: "Si le compte existe, un code a été envoyé" } };
      case "post /auth/signup/verify": {
        const key = body.email ?? body.phone;
        const profile = pending.get(key);
        if (!profile || body.code !== CODE)
          throw new HttpFailure(400, "OTP_INVALID", "Code invalide ou expiré");
        pending.delete(key);
        const user = addUser({ ...profile, email: body.email, phone: body.phone });
        return openSession(user, body.device);
      }
      case "post /auth/login/otp/request": {
        const user = findUser(body);
        if (!user) throw new HttpFailure(404, "USER_NOT_FOUND", "Compte introuvable");
        const viaEmail = Boolean(body.email) || body.channel === "EMAIL";
        return {
          status: 200,
          data: {
            method: viaEmail ? "EMAIL" : "PHONE",
            target: body.email ?? body.phone,
            expiresMinutes: 10,
          },
        };
      }
      case "post /auth/login/otp/verify": {
        const user = findUser(body);
        if (!user || body.code !== CODE)
          throw new HttpFailure(400, "OTP_INVALID", "Code invalide ou expiré");
        return signInOrChallenge(user, body.device);
      }
      case "post /auth/login/password": {
        const user = users.find((u) => u.email === body.email);
        if (!user || !user.password || user.password !== body.password) {
          throw new HttpFailure(401, "INVALID_CREDENTIALS", "E-mail ou mot de passe incorrect");
        }
        return signInOrChallenge(user, body.device);
      }
      case "post /auth/2fa/verify": {
        const challenge = challenges.get(body.challengeToken);
        if (!challenge)
          throw new HttpFailure(401, "TWO_FACTOR_CHALLENGE_EXPIRED", "La vérification a expiré");
        if (body.code !== CODE && !body.backupCode) {
          throw new HttpFailure(400, "TWO_FACTOR_INVALID", "Code invalide");
        }
        challenges.delete(body.challengeToken);
        return openSession(
          users.find((u) => u.id === challenge.userId)!,
          challenge.device,
        );
      }
      case "post /auth/refresh":
        return refresh(config, body);
      case "get /auth/me": {
        const session = authenticate(config);
        const user = userOf(session);
        return {
          status: 200,
          data: {
            user: {
              ...publicUser(user),
              emailVerified: Boolean(user.email),
              phoneVerified: Boolean(user.phone),
              hasPassword: Boolean(user.password),
              verificationStatus: "NOT_SUBMITTED",
              twoFactorEnabled: user.twoFactor,
              createdAt: session.createdAt,
              lastLoginAt: session.createdAt,
              sessionId: session.id,
            },
          },
        };
      }
      case "post /auth/logout": {
        authenticate(config).revoked = true;
        cookieJar.access = cookieJar.refresh = null;
        return { status: 204 };
      }
      case "post /auth/logout-all": {
        const session = authenticate(config);
        const mine = sessions.filter((s) => s.userId === session.userId && !s.revoked);
        for (const s of mine) s.revoked = true;
        cookieJar.access = cookieJar.refresh = null;
        return { status: 200, data: { revoked: mine.length } };
      }
      case "get /auth/sessions": {
        const session = authenticate(config);
        return {
          status: 200,
          data: {
            sessions: sessions
              .filter((s) => s.userId === session.userId && !s.revoked)
              .map((s) => ({
                id: s.id,
                deviceName: s.deviceName,
                platform: s.platform,
                city: null,
                country: null,
                ipAddress: null,
                createdAt: s.createdAt,
                lastSeenAt: s.createdAt,
                current: s.id === session.id,
              })),
          },
        };
      }
      default: {
        const del = /^\/auth\/sessions\/([^/]+)$/.exec(path);
        if (method === "delete" && del) {
          const session = authenticate(config);
          const target = sessions.find(
            (s) =>
              s.id === decodeURIComponent(del[1]!) && s.userId === session.userId && !s.revoked,
          );
          if (!target) throw new HttpFailure(404, "SESSION_NOT_FOUND", "Appareil introuvable");
          target.revoked = true;
          return { status: 200, data: { revoked: true, current: target.id === session.id } };
        }
        throw new HttpFailure(404, "NOT_FOUND", "Ressource introuvable");
      }
    }
  }

  const transport: AxiosAdapter = (config) => {
    const path = String(config.url).split("?")[0] ?? "";
    const body = asRecord(typeof config.data === "string" ? JSON.parse(config.data) : config.data);
    requests.push({ method: String(config.method).toLowerCase(), path, body });

    if (offline) return Promise.reject(new AxiosError("Network Error", "ERR_NETWORK", config));

    let reply: Reply;
    try {
      reply = handle(config, path, body);
    } catch (error) {
      if (!(error instanceof HttpFailure)) throw error;
      reply = {
        status: error.status,
        data: { error: { code: error.code, message: error.message, requestId: "fake" } },
      };
    }

    const response = {
      status: reply.status,
      statusText: "",
      data: reply.data,
      headers: new AxiosHeaders(),
      config,
    };
    if (reply.status < 300) return Promise.resolve(response);
    return Promise.reject(
      new AxiosError("failed", "ERR_BAD_RESPONSE", config, undefined, response),
    );
  };

  return {
    transport,
    requests,
    code: CODE,
    addUser: (input) => publicUser(addUser(input)),
    expireAccessTokens(): void {
      for (const token of accessTokens.keys()) expired.add(token);
    },
    revokeSessions(): void {
      for (const s of sessions) s.revoked = true;
    },
    setOffline(value): void {
      offline = value;
    },
  };
}
