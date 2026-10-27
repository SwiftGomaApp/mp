export const AUTH_COOKIE_NAMES = ["__Host-swg_access", "swg_refresh"] as const;

export interface ForwardAuthOptions {
  cookie: string | null | undefined;
  origin?: string;
}

export function forwardAuthHeaders({ cookie, origin }: ForwardAuthOptions): Record<string, string> {
  if (!cookie) return {};

  const allowed: readonly string[] = AUTH_COOKIE_NAMES;
  const kept: string[] = [];
  for (const part of cookie.split(";")) {
    const pair = part.trim();
    const separator = pair.indexOf("=");
    if (separator <= 0 || /[\r\n]/.test(pair)) continue;
    if (allowed.includes(pair.slice(0, separator))) kept.push(pair);
  }

  if (kept.length === 0) return {};
  return { Cookie: kept.join("; "), ...(origin ? { Origin: origin } : {}) };
}
