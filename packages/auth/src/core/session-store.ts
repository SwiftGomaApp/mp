import type { AuthAdapter } from "./adapter";
import { DEFAULT_ACCESS_TTL_SECONDS } from "./constants";
import { readJwtExpiry } from "./jwt";

export const REFRESH_TOKEN_STORAGE_KEY = "swiftgoma-mp-auth.refreshToken";
export const ACCESS_TOKEN_STORAGE_KEY = "swiftgoma-mp-auth.accessToken";

export type SessionStatus = "unknown" | "authenticated" | "anonymous";

export interface SessionState<TUser = unknown> {
  status: SessionStatus;
  user: TUser | null;
  accessExpiresAt: number | null;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds?: number;
}

export interface SessionStoreOptions {
  now?: () => number;
}

export interface SessionStore<TUser = unknown> {
  getState(): SessionState<TUser>;
  subscribe(listener: (state: SessionState<TUser>) => void): () => void;
  onAccessTokenChange(listener: (accessToken: string | null) => void): () => void;
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  hydrate(): Promise<void>;
  signIn(user: TUser, tokens?: SessionTokens): Promise<void>;
  updateTokens(tokens: SessionTokens): Promise<void>;
  setUser(user: TUser): void;
  setAccessExpiresIn(seconds: number): void;
  clear(): Promise<void>;
}

interface StoredAccess {
  token: string;
  expiresAt: number | null;
}

function parseStoredAccess(raw: string | null): StoredAccess | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { token, expiresAt } = value as Record<string, unknown>;
    if (typeof token !== "string" || !token) return null;
    return { token, expiresAt: typeof expiresAt === "number" ? expiresAt : null };
  } catch {
    return null;
  }
}

export function createSessionStore<TUser = unknown>(
  adapter: AuthAdapter,
  options: SessionStoreOptions = {},
): SessionStore<TUser> {
  const now = options.now ?? Date.now;
  const keepsTokens = adapter.platform !== "WEB";

  let state: SessionState<TUser> = { status: "unknown", user: null, accessExpiresAt: null };
  let accessToken: string | null = null;
  let refreshToken: string | null = null;

  const stateListeners = new Set<(state: SessionState<TUser>) => void>();
  const tokenListeners = new Set<(accessToken: string | null) => void>();

  let writes: Promise<void> = Promise.resolve();
  function enqueue(task: () => Promise<void>): Promise<void> {
    const run = writes.then(task);
    writes = run.catch(() => undefined);
    return run;
  }

  function setState(next: SessionState<TUser>): void {
    state = next;
    for (const listener of [...stateListeners]) {
      try {
        listener(state);
      } catch {}
    }
  }

  function announceAccessToken(): void {
    for (const listener of [...tokenListeners]) {
      try {
        listener(accessToken);
      } catch {}
    }
  }

  function remember(tokens: SessionTokens): number | null {
    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;
    if (tokens.expiresInSeconds !== undefined) return now() + tokens.expiresInSeconds * 1000;
    // The server's word first, then the token's own claim, then the usual lifetime.
    return readJwtExpiry(tokens.accessToken) ?? now() + DEFAULT_ACCESS_TTL_SECONDS * 1000;
  }

  function persist(tokens: SessionTokens, expiresAt: number | null): Promise<void> {
    return enqueue(async () => {
      await adapter.storage.setItem(REFRESH_TOKEN_STORAGE_KEY, tokens.refreshToken);
      await adapter.storage.setItem(
        ACCESS_TOKEN_STORAGE_KEY,
        JSON.stringify({ token: tokens.accessToken, expiresAt }),
      );
    });
  }

  function requireTokens(tokens: SessionTokens | undefined): SessionTokens {
    if (!tokens?.accessToken || !tokens.refreshToken) {
      throw new TypeError("swiftgoma-mp-auth: a mobile device needs an access and a refresh token");
    }
    return tokens;
  }

  return {
    getState: () => state,

    subscribe(listener): () => void {
      stateListeners.add(listener);
      return () => void stateListeners.delete(listener);
    },

    onAccessTokenChange(listener): () => void {
      tokenListeners.add(listener);
      return () => void tokenListeners.delete(listener);
    },

    getAccessToken: () => accessToken,
    getRefreshToken: () => refreshToken,

    async hydrate(): Promise<void> {
      if (!keepsTokens) return;

      const storedRefresh = await adapter.storage.getItem(REFRESH_TOKEN_STORAGE_KEY);
      const storedAccess = parseStoredAccess(
        await adapter.storage.getItem(ACCESS_TOKEN_STORAGE_KEY),
      );

      if (!storedRefresh) {
        setState({ status: "anonymous", user: null, accessExpiresAt: null });
        return;
      }
      refreshToken = storedRefresh;
      accessToken = storedAccess?.token ?? null;
      setState({
        ...state,
        accessExpiresAt:
          storedAccess?.expiresAt ?? (storedAccess ? readJwtExpiry(storedAccess.token) : null),
      });
      announceAccessToken();
    },

    async signIn(user, tokens): Promise<void> {
      if (!keepsTokens) {
        if (tokens) {
          throw new TypeError("swiftgoma-mp-auth: a browser session uses cookies, not tokens");
        }
        setState({
          status: "authenticated",
          user,
          accessExpiresAt: now() + DEFAULT_ACCESS_TTL_SECONDS * 1000,
        });
        return;
      }

      const given = requireTokens(tokens);
      const expiresAt = remember(given);
      setState({ status: "authenticated", user, accessExpiresAt: expiresAt });
      announceAccessToken();
      await persist(given, expiresAt);
    },

    async updateTokens(tokens): Promise<void> {
      if (!keepsTokens) {
        throw new TypeError("swiftgoma-mp-auth: a browser session uses cookies, not tokens");
      }
      const given = requireTokens(tokens);
      const expiresAt = remember(given);
      setState({ ...state, accessExpiresAt: expiresAt });
      announceAccessToken();
      await persist(given, expiresAt);
    },

    setAccessExpiresIn(seconds): void {
      setState({ ...state, accessExpiresAt: now() + seconds * 1000 });
    },

    setUser(user): void {
      setState({ ...state, status: "authenticated", user });
    },

    async clear(): Promise<void> {
      const hadToken = accessToken !== null;
      accessToken = null;
      refreshToken = null;
      setState({ status: "anonymous", user: null, accessExpiresAt: null });
      if (hadToken) announceAccessToken();
      if (!keepsTokens) return;

      await enqueue(async () => {
        await adapter.storage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
        await adapter.storage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
      });
    },
  };
}
