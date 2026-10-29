import axios from "axios";
import type { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import { API_PREFIX, DEFAULT_REQUEST_TIMEOUT_MS } from "./constants";
import { createApiError, createNetworkError, createTimeoutError, isApiError } from "./errors";
import type { HeaderMap } from "./errors";

export interface HttpClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  withCredentials?: boolean;
  adapter?: AxiosRequestConfig["adapter"];
}

export function resolveBaseUrl(baseUrl: string): string {
  const origin = baseUrl.trim().replace(/\/+$/, "");
  if (!origin) throw new TypeError("swiftgoma-mp-auth: baseUrl is required");
  return origin.endsWith(API_PREFIX) ? origin : `${origin}${API_PREFIX}`;
}

function toHeaderMap(headers: unknown): HeaderMap {
  const result: Record<string, string | undefined> = {};
  if (typeof headers !== "object" || headers === null) return result;
  for (const [name, value] of Object.entries(headers)) {
    if (typeof value === "string") result[name.toLowerCase()] = value;
  }
  return result;
}

export function toApiError(error: unknown): unknown {
  if (isApiError(error) || axios.isCancel(error) || !axios.isAxiosError(error)) return error;

  const failure = error as AxiosError;
  if (failure.response) {
    return createApiError(
      {
        status: failure.response.status,
        body: failure.response.data,
        headers: toHeaderMap(failure.response.headers),
      },
      failure,
    );
  }
  if (failure.code === "ECONNABORTED" || failure.code === "ETIMEDOUT") {
    return createTimeoutError(failure);
  }
  return createNetworkError();
}

export function createHttpClient(options: HttpClientOptions): AxiosInstance {
  const client = axios.create({
    baseURL: resolveBaseUrl(options.baseUrl),
    timeout: options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
    headers: { Accept: "application/json", ...options.headers },
    withCredentials: options.withCredentials ?? false,
    adapter: options.adapter,
  });

  client.interceptors.response.use(undefined, (error: unknown) =>
    Promise.reject(toApiError(error)),
  );
  return client;
}
