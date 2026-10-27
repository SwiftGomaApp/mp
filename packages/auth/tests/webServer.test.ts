import { describe, expect, it } from "vitest";
import { AUTH_COOKIE_NAMES, forwardAuthHeaders } from "../src/web/index";

describe("forwardAuthHeaders", () => {
  it("knows the two cookies the API sets", () => {
    expect([...AUTH_COOKIE_NAMES]).toEqual(["__Host-swg_access", "swg_refresh"]);
  });

  it("forwards only the session cookies", () => {
    const headers = forwardAuthHeaders({
      cookie: "theme=dark; __Host-swg_access=abc; analytics=1; swg_refresh=def",
    });

    expect(headers).toEqual({ Cookie: "__Host-swg_access=abc; swg_refresh=def" });
  });

  it("adds the app origin when given", () => {
    expect(
      forwardAuthHeaders({ cookie: "__Host-swg_access=abc", origin: "https://app.swiftgoma.com" }),
    ).toEqual({ Cookie: "__Host-swg_access=abc", Origin: "https://app.swiftgoma.com" });
  });

  it("sends nothing when there is no session cookie", () => {
    expect(forwardAuthHeaders({ cookie: undefined })).toEqual({});
    expect(forwardAuthHeaders({ cookie: null })).toEqual({});
    expect(forwardAuthHeaders({ cookie: "" })).toEqual({});
    expect(
      forwardAuthHeaders({ cookie: "theme=dark", origin: "https://app.swiftgoma.com" }),
    ).toEqual({});
  });

  it("does not match look-alike names or malformed pairs", () => {
    expect(
      forwardAuthHeaders({ cookie: "x__Host-swg_access=1; swg_refresh_old=2; =3; swg_refresh" }),
    ).toEqual({});
  });
});
