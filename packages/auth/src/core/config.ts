import type { Logger, PlatformAdapter } from "./adapters";
import {
  API_BASE_PATH,
  DEFAULT_REFRESH_MARGIN_SECONDS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  PLATFORMS,
} from "./constants";

export interface SocialsConfig {
  google?: boolean;
  apple?: boolean;
}

export interface AuthConfig {
  baseUrl: string;
  adapter: PlatformAdapter;
  socials?: SocialsConfig;
  refreshMarginSeconds?: number;
  requestTimeoutMs?: number;
  logger?: Logger;
  now?: () => number;
}

export interface ResolvedAuthConfig {
  baseUrl: string;
  apiUrl: string;
  adapter: PlatformAdapter;
  socials: { google: boolean; apple: boolean };
  refreshMarginSeconds: number;
  requestTimeoutMs: number;
  logger: Logger;
  now: () => number;
}

export class ConfigError extends Error {
  override name = "ConfigError";
}

const NOOP_LOGGER: Logger = {
  debug() {},
  warn() {},
  error() {},
};

const LOCAL_HOST =
  /^(localhost|127(\.\d{1,3}){3}|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}|\[::1\]|.+\.local)$/i;

function resolveBaseUrl(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ConfigError("baseUrl is required");
  }

  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new ConfigError(`baseUrl is not a valid URL: ${value}`);
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ConfigError("baseUrl must start with http:// or https://");
  }
  if (url.protocol === "http:" && !LOCAL_HOST.test(url.hostname)) {
    throw new ConfigError("baseUrl must use https unless it points to a local or private address");
  }
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") {
    throw new ConfigError(
      "baseUrl must be the API origin only, without a path (the package adds /api/v1)",
    );
  }

  return url.origin;
}

function resolveNumber(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
  name: string,
): number {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < min || value > max) {
    throw new ConfigError(`${name} must be a whole number between ${min} and ${max}`);
  }
  return value;
}

function resolveAdapter(adapter: PlatformAdapter | undefined): PlatformAdapter {
  if (!adapter) throw new ConfigError("adapter is required");

  const platforms: string[] = Object.values(PLATFORMS);
  if (!platforms.includes(adapter.platform)) {
    throw new ConfigError(`adapter.platform must be one of ${platforms.join(", ")}`);
  }

  const expected = adapter.platform === PLATFORMS.WEB ? "cookie" : "bearer";
  if (adapter.transport !== expected) {
    throw new ConfigError(
      `the ${adapter.platform} platform must use the "${expected}" transport, not "${adapter.transport}"`,
    );
  }

  return adapter;
}

function resolveFlag(value: boolean | undefined, name: string): boolean {
  if (value === undefined) return false;
  if (typeof value !== "boolean") throw new ConfigError(`${name} must be true or false`);
  return value;
}

export function resolveConfig(config: AuthConfig): ResolvedAuthConfig {
  const baseUrl = resolveBaseUrl(config.baseUrl);

  return {
    baseUrl,
    apiUrl: `${baseUrl}${API_BASE_PATH}`,
    adapter: resolveAdapter(config.adapter),
    socials: {
      google: resolveFlag(config.socials?.google, "socials.google"),
      apple: resolveFlag(config.socials?.apple, "socials.apple"),
    },
    refreshMarginSeconds: resolveNumber(
      config.refreshMarginSeconds,
      DEFAULT_REFRESH_MARGIN_SECONDS,
      10,
      600,
      "refreshMarginSeconds",
    ),
    requestTimeoutMs: resolveNumber(
      config.requestTimeoutMs,
      DEFAULT_REQUEST_TIMEOUT_MS,
      1_000,
      120_000,
      "requestTimeoutMs",
    ),
    logger: config.logger ?? NOOP_LOGGER,
    now: config.now ?? Date.now,
  };
}
