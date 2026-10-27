export const DEFAULT_CHALLENGE_TTL_SECONDS = 300;

export type ChallengeKind = "verify" | "enroll";

export interface Challenge {
  token: string;
  kind: ChallengeKind;
  expiresAt: number;
}

export class ChallengeStore {
  private current: Challenge | null = null;
  private readonly now: () => number;

  constructor(now: () => number) {
    this.now = now;
  }

  set(token: string, kind: ChallengeKind, expiresInSeconds: number): void {
    this.current = { token, kind, expiresAt: this.now() + expiresInSeconds * 1000 };
  }

  get(): Challenge | null {
    if (this.current && this.current.expiresAt <= this.now()) this.current = null;
    return this.current;
  }

  clear(): void {
    this.current = null;
  }
}
