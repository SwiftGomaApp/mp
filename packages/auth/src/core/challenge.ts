/**
 * The token of a login that needs a second step. It lives only in memory, for the few minutes
 * the server accepts it, and never reaches the app.
 */
export interface ChallengeHolder {
  set(token: string, expiresInSeconds: number): void;
  /** The token, or `null` if there is none or it ran out. */
  get(): string | null;
  clear(): void;
}

export function createChallengeHolder(now: () => number = Date.now): ChallengeHolder {
  let current: { token: string; expiresAt: number } | null = null;

  return {
    set(token, expiresInSeconds): void {
      current = { token, expiresAt: now() + expiresInSeconds * 1000 };
    },
    get(): string | null {
      if (current && now() >= current.expiresAt) current = null;
      return current?.token ?? null;
    },
    clear(): void {
      current = null;
    },
  };
}
