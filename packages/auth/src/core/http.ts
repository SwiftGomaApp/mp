import axios, {
  AxiosHeaders,
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from "axios";
import type { ResolvedAuthConfig } from "./config";
import { NetworkError, TimeoutError, createApiError, isApiError } from "./errors";

export type AuthRequestConfig = AxiosRequestConfig & {
  skipAuth?: boolean;
  authRetried?: boolean;
};

export interface UnauthorizedContext {
  error: AxiosError;
  request: AuthRequestConfig;
  retry(): Promise<AxiosResponse>;
}

export type RecoverFromUnauthorized = (
  context: UnauthorizedContext,
) => Promise<AxiosResponse | undefined>;

export interface HttpClientOptions {
  config: ResolvedAuthConfig;
  getAccessToken?: () => string | null | Promise<string | null>;
  recoverFromUnauthorized?: RecoverFromUnauthorized;
}

function headersToRecord(headers: unknown): Record<string, unknown> | undefined {
  if (!headers || typeof headers !== "object") return undefined;
  const candidate = headers as { toJSON?: () => Record<string, unknown> };
  return typeof candidate.toJSON === "function"
    ? candidate.toJSON()
    : (headers as Record<string, unknown>);
}

export function toApiError(error: unknown): unknown {
  if (isApiError(error) || axios.isCancel(error)) return error;
  if (!axios.isAxiosError(error)) return error;

  if (error.response) {
    return createApiError({
      status: error.response.status,
      data: error.response.data,
      headers: headersToRecord(error.response.headers),
      cause: error,
    });
  }

  if (error.code === "ERR_CANCELED") return error;
  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    return new TimeoutError({ cause: error });
  }
  return new NetworkError({ cause: error });
}

function retryRequest(client: AxiosInstance, request: AuthRequestConfig): Promise<AxiosResponse> {
  const headers = new AxiosHeaders(request.headers as AxiosHeaders | undefined);
  headers.delete("Authorization");
  return client.request({ ...request, headers });
}

export function createHttpClient(options: HttpClientOptions): AxiosInstance {
  const { config, getAccessToken, recoverFromUnauthorized } = options;
  const { adapter } = config;
  const bearer = adapter.transport === "bearer";

  const client = axios.create({
    baseURL: config.apiUrl,
    timeout: config.requestTimeoutMs,
    withCredentials: !bearer,
    headers: { Accept: "application/json" },
  });

  client.interceptors.request.use(async (request) => {
    if (!bearer) return request;

    if (adapter.userAgent && !request.headers.has("User-Agent")) {
      request.headers.set("User-Agent", adapter.userAgent);
    }

    const flags = request as unknown as { skipAuth?: boolean };
    if (!flags.skipAuth && getAccessToken && !request.headers.has("Authorization")) {
      const token = await getAccessToken();
      if (token) request.headers.set("Authorization", `Bearer ${token}`);
    }

    return request;
  });

  client.interceptors.response.use(undefined, async (error: unknown) => {
    if (
      recoverFromUnauthorized &&
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      error.config
    ) {
      const request = error.config as AuthRequestConfig;

      if (!request.skipAuth && !request.authRetried) {
        request.authRetried = true;
        try {
          const recovered = await recoverFromUnauthorized({
            error,
            request,
            retry: () => retryRequest(client, request),
          });
          if (recovered) return recovered;
        } catch (recoveryError) {
          throw toApiError(recoveryError);
        }
      }
    }

    throw toApiError(error);
  });

  return client;
}
