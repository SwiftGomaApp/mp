import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadWithMocks } from "../helpers/mockModules.mjs";

let token;
const geo = () =>
  loadWithMocks("core/geo/geo.js", {
    "config/env.config.js": { getConfig: () => ({ geo: { ipinfoToken: token } }) },
  });

const realFetch = globalThis.fetch;

beforeEach(() => {
  token = "";
  globalThis.fetch = vi.fn();
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("IP location lookup", () => {
  it("gives nothing for private, local or missing addresses", async () => {
    const { lookupIp } = geo();
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "192.168.1.20",
      "172.16.0.5",
      "::1",
      "",
      null,
      undefined,
    ]) {
      expect(await lookupIp(ip)).toEqual({ city: null, country: null });
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses only the offline database when no token is set, never contacting a third party", async () => {
    const { lookupIp } = geo();
    const result = await lookupIp("8.8.8.8");
    expect(result.country).toBe("États-Unis");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("understands IPv4 addresses written as IPv6", async () => {
    const { lookupIp } = geo();
    expect((await lookupIp("::ffff:8.8.8.8")).country).toBe("États-Unis");
  });

  it("asks the online service when a token is configured", async () => {
    token = "secret-token";
    fetch.mockResolvedValue({ ok: true, json: async () => ({ city: "Goma", country: "CD" }) });
    const { lookupIp } = geo();

    expect(await lookupIp("41.79.0.1")).toEqual({
      city: "Goma",
      country: "Congo-Kinshasa",
    });
    expect(String(fetch.mock.calls[0][0])).toBe(
      "https://ipinfo.io/41.79.0.1/json?token=secret-token",
    );
  });

  it("falls back to the offline database when the online service fails", async () => {
    token = "secret-token";
    fetch.mockRejectedValue(new Error("timeout"));
    const { lookupIp } = geo();
    expect((await lookupIp("8.8.8.8")).country).toBe("États-Unis");

    fetch.mockResolvedValue({ ok: false, status: 429 });
    expect((await lookupIp("8.8.8.8")).country).toBe("États-Unis");
  });

  it("returns nothing for an address no database knows", async () => {
    const { lookupIp } = geo();
    expect(await lookupIp("203.0.113.9")).toEqual({ city: null, country: null });
  });
});
