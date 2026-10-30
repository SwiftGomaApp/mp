import { AxiosError, AxiosHeaders } from "axios";
import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { describe, expect, it } from "vitest";
import {
  ApiError,
  NetworkError,
  TimeoutError,
  TooManyRequestsError,
  ValidationError,
  createHttpClient,
  resolveBaseUrl,
} from "../src/index";

interface Answer {
  status: number;
  data?: unknown;
  headers?: Record<string, string>;
}

function answering(answer: Answer, seen?: InternalAxiosRequestConfig[]): AxiosAdapter {
  return (config) => {
    seen?.push(config);
    const response = {
      status: answer.status,
      statusText: "",
      data: answer.data,
      headers: new AxiosHeaders(answer.headers),
      config,
    };
    if (answer.status >= 200 && answer.status < 300) return Promise.resolve(response);
    return Promise.reject(
      new AxiosError("failed", "ERR_BAD_RESPONSE", config, undefined, response),
    );
  };
}

function failing(code: string): AxiosAdapter {
  return (config) => Promise.reject(new AxiosError("failed", code, config));
}

const client = (adapter: AxiosAdapter): ReturnType<typeof createHttpClient> =>
  createHttpClient({ baseUrl: "https://api.example.com", adapter });

describe("resolveBaseUrl", () => {
  it.each([
    ["https://api.example.com", "https://api.example.com/api/v1"],
    ["https://api.example.com/", "https://api.example.com/api/v1"],
    ["https://api.example.com///", "https://api.example.com/api/v1"],
    ["https://api.example.com/api/v1", "https://api.example.com/api/v1"],
    ["https://api.example.com/api/v1/", "https://api.example.com/api/v1"],
    ["  http://localhost:4000 ", "http://localhost:4000/api/v1"],
  ])("turns %s into %s", (input, expected) => {
    expect(resolveBaseUrl(input)).toBe(expected);
  });

  it("refuses an empty address", () => {
    expect(() => resolveBaseUrl("  ")).toThrow(TypeError);
  });
});

describe("createHttpClient: configuration", () => {
  it("uses the API prefix, a 15 s timeout and no cookies by default", async () => {
    const seen: InternalAxiosRequestConfig[] = [];
    await client(answering({ status: 200, data: {} }, seen)).get("/health");
    expect(seen[0]?.baseURL).toBe("https://api.example.com/api/v1");
    expect(seen[0]?.timeout).toBe(15_000);
    expect(seen[0]?.withCredentials).toBe(false);
    expect(seen[0]?.headers.get("Accept")).toBe("application/json");
  });

  it("applies the options", async () => {
    const seen: InternalAxiosRequestConfig[] = [];
    const custom = createHttpClient({
      baseUrl: "https://api.example.com",
      timeoutMs: 3000,
      withCredentials: true,
      headers: { "X-App-Version": "1.2.3" },
      adapter: answering({ status: 200, data: {} }, seen),
    });
    await custom.get("/health");
    expect(seen[0]?.timeout).toBe(3000);
    expect(seen[0]?.withCredentials).toBe(true);
    expect(seen[0]?.headers.get("X-App-Version")).toBe("1.2.3");
  });

  it("returns successful answers untouched", async () => {
    const response = await client(answering({ status: 200, data: { ok: true } })).get("/x");
    expect(response.data).toEqual({ ok: true });
  });
});

describe("createHttpClient: failures", () => {
  it("rejects with the error the server described", async () => {
    const api = client(
      answering({
        status: 400,
        data: { error: { code: "OTP_INVALID", message: "Code invalide", requestId: "r1" } },
      }),
    );
    const error = await api.post("/auth/verify").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "OTP_INVALID", status: 400, requestId: "r1" });
    expect((error as ApiError).cause).toBeInstanceOf(AxiosError);
  });

  it("lists the refused fields on a 422", async () => {
    const api = client(
      answering({
        status: 422,
        data: {
          error: {
            code: "VALIDATION_ERROR",
            message: "Données invalides",
            details: [{ field: "email", message: "E-mail invalide" }],
          },
        },
      }),
    );
    const error = await api.post("/auth/signup").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).messagesByField).toEqual({ email: "E-mail invalide" });
  });

  it("reads Retry-After from the response headers", async () => {
    const api = client(
      answering({
        status: 429,
        data: { error: { code: "TOO_MANY_REQUESTS", message: "Trop" } },
        headers: { "Retry-After": "30" },
      }),
    );
    const error = await api.get("/x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TooManyRequestsError);
    expect((error as TooManyRequestsError).retryAfterSeconds).toBe(30);
  });

  it("uses the request id header when the body has none", async () => {
    const api = client(
      answering({
        status: 502,
        data: "<html>Bad gateway</html>",
        headers: { "X-Request-Id": "edge-7" },
      }),
    );
    const error = await api.get("/x").catch((e: unknown) => e);
    expect(error).toMatchObject({ code: "UNKNOWN_ERROR", status: 502, requestId: "edge-7" });
  });

  it.each(["ECONNABORTED", "ETIMEDOUT"])("reports %s as a timeout", async (code) => {
    const error = await client(failing(code))
      .get("/x")
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TimeoutError);
    expect(error).toMatchObject({ code: "TIMEOUT" });
  });

  it.each(["ERR_NETWORK", "ECONNREFUSED", "ENOTFOUND"])(
    "reports %s as a network error",
    async (code) => {
      const error = await client(failing(code))
        .get("/x")
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(NetworkError);
      expect(error).toMatchObject({ code: "NETWORK_ERROR" });
    },
  );

  it("leaves a cancelled call alone", async () => {
    const controller = new AbortController();
    controller.abort();
    const api = client(() => Promise.reject(new AxiosError("canceled", "ERR_CANCELED")));
    const error = await api.get("/x", { signal: controller.signal }).catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(ApiError);
    expect((error as AxiosError).code).toBe("ERR_CANCELED");
  });

  it("leaves a programming error alone", async () => {
    const api = client(() => Promise.reject(new TypeError("boom")));
    const error = await api.get("/x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TypeError);
  });
});
