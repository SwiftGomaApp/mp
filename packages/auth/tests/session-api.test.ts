import { describe, expect, it } from "vitest";
import { NetworkError } from "../src/index";
import { USER, fail, makeAuth, ok, rotated, savedPhoneSession } from "./helpers";
import type { Reply } from "./helpers";

const ME = {
  ...USER,
  emailVerified: true,
  phoneVerified: false,
  hasPassword: true,
  verificationStatus: "NOT_SUBMITTED",
  twoFactorEnabled: false,
  createdAt: "2026-10-01T10:00:00.000Z",
  lastLoginAt: null,
  sessionId: "s1",
};

const signedInPhone = () => savedPhoneSession(Date.now() + 600_000);

describe("me", () => {
  it("returns the user and makes the session authenticated", async () => {
    const { auth, calls } = makeAuth("ANDROID", () => ok({ user: ME }), signedInPhone());
    await auth.start();
    const user = await auth.me();

    expect(user).toEqual(ME);
    expect(calls[0]).toMatchObject({ method: "get", url: "/auth/me", auth: "Bearer access-1" });
    expect(auth.session.getState()).toMatchObject({ status: "authenticated", user: ME });
    auth.stop();
  });

  it("restores a browser session whose access cookie has expired", async () => {
    let refreshed = false;
    const { auth, calls } = makeAuth("WEB", (seen) => {
      if (seen.url === "/auth/refresh") {
        refreshed = true;
        return ok({ expiresIn: 900 });
      }
      return refreshed ? ok({ user: ME }) : fail(401, "UNAUTHORIZED");
    });
    await auth.start();
    const user = await auth.me();

    expect(user).toEqual(ME);
    expect(calls.map((c) => c.url)).toEqual(["/auth/me", "/auth/refresh", "/auth/me"]);
    expect(auth.session.getState().status).toBe("authenticated");
    auth.stop();
  });

  it("reports a browser with no session at all", async () => {
    const { auth } = makeAuth("WEB", (seen) =>
      seen.url === "/auth/refresh" ? fail(401, "REFRESH_TOKEN_MISSING") : fail(401, "UNAUTHORIZED"),
    );
    await auth.start();
    await expect(auth.me()).rejects.toMatchObject({ code: "REFRESH_TOKEN_MISSING" });
    expect(auth.session.getState().status).toBe("anonymous");
    auth.stop();
  });

  it("refuses an answer without a user", async () => {
    const { auth } = makeAuth("ANDROID", () => ok({}), signedInPhone());
    await auth.start();
    await expect(auth.me()).rejects.toMatchObject({ code: "UNKNOWN_ERROR" });
    auth.stop();
  });
});

describe("logout", () => {
  const server = (seen: { url: string }): Reply =>
    seen.url === "/auth/logout" ? { status: 204 } : ok();

  it("tells the server, then forgets the session everywhere", async () => {
    const { auth, calls, storage } = makeAuth("ANDROID", server, signedInPhone());
    await auth.start();
    await auth.logout();

    expect(calls[0]).toMatchObject({
      method: "post",
      url: "/auth/logout",
      auth: "Bearer access-1",
    });
    expect(auth.session.getState().status).toBe("anonymous");
    expect(await auth.session.getAccessToken()).toBeNull();
    expect(await storage.getItem("swiftgoma-mp-auth.refreshToken")).toBeNull();
    auth.stop();
  });

  it("is fine when the server already forgot the session", async () => {
    const { auth, storage } = makeAuth(
      "ANDROID",
      (seen) => (seen.url === "/auth/logout" ? fail(401, "SESSION_REVOKED") : ok()),
      signedInPhone(),
    );
    await auth.start();
    await auth.logout();
    expect(auth.session.getState().status).toBe("anonymous");
    expect(await storage.getItem("swiftgoma-mp-auth.refreshToken")).toBeNull();
    auth.stop();
  });

  it("forgets the session locally even when the server cannot be reached", async () => {
    const { auth, storage } = makeAuth(
      "ANDROID",
      (seen) => (seen.url === "/auth/logout" ? new Error("offline") : ok()),
      signedInPhone(),
    );
    await auth.start();
    await expect(auth.logout()).rejects.toBeInstanceOf(NetworkError);
    expect(auth.session.getState().status).toBe("anonymous");
    expect(await storage.getItem("swiftgoma-mp-auth.refreshToken")).toBeNull();
    auth.stop();
  });

  it("signs a browser out", async () => {
    const { auth, calls } = makeAuth("WEB", server);
    await auth.signup.verify({ email: "gael@example.com", code: "123456" }).catch(() => undefined);
    await auth.logout();
    expect(calls.some((c) => c.url === "/auth/logout")).toBe(true);
    expect(auth.session.getState().status).toBe("anonymous");
  });

  it("signs out of every device and says how many", async () => {
    const { auth, calls } = makeAuth(
      "ANDROID",
      (seen) => (seen.url === "/auth/logout-all" ? ok({ revoked: 3 }) : ok()),
      signedInPhone(),
    );
    await auth.start();
    expect(await auth.logoutAll()).toEqual({ revoked: 3 });
    expect(calls[0]?.url).toBe("/auth/logout-all");
    expect(auth.session.getState().status).toBe("anonymous");
    auth.stop();
  });
});

describe("devices", () => {
  const sessions = [
    {
      id: "s1",
      deviceName: "Pixel 8",
      platform: "ANDROID",
      city: "Goma",
      country: "CD",
      ipAddress: "1.2.3.4",
      createdAt: "2026-10-01T10:00:00.000Z",
      lastSeenAt: "2026-10-29T10:00:00.000Z",
      current: true,
    },
    { id: "s2", deviceName: "Chrome on Windows", platform: "WEB", current: false },
  ];

  it("lists the signed-in devices", async () => {
    const { auth, calls } = makeAuth("ANDROID", () => ok({ sessions }), signedInPhone());
    await auth.start();
    const list = await auth.devices.list();

    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ id: "s1", current: true });
    expect(calls[0]).toMatchObject({ method: "get", url: "/auth/sessions" });
    auth.stop();
  });

  it("signs another device out and keeps this session", async () => {
    const { auth, calls } = makeAuth(
      "ANDROID",
      () => ok({ revoked: true, current: false }),
      signedInPhone(),
    );
    await auth.start();
    expect(await auth.devices.disconnect("s2")).toEqual({ current: false });

    expect(calls[0]).toMatchObject({ method: "delete", url: "/auth/sessions/s2" });
    expect(auth.session.getState().status).not.toBe("anonymous");
    expect(await auth.session.getAccessToken()).toBe("access-1");
    auth.stop();
  });

  it("ends the local session when the current device is disconnected", async () => {
    const { auth, storage } = makeAuth(
      "ANDROID",
      () => ok({ revoked: true, current: true }),
      signedInPhone(),
    );
    await auth.start();
    expect(await auth.devices.disconnect("s1")).toEqual({ current: true });
    expect(auth.session.getState().status).toBe("anonymous");
    expect(await storage.getItem("swiftgoma-mp-auth.refreshToken")).toBeNull();
    auth.stop();
  });

  it("escapes the id in the address", async () => {
    const { auth, calls } = makeAuth(
      "ANDROID",
      () => ok({ revoked: true, current: false }),
      signedInPhone(),
    );
    await auth.start();
    await auth.devices.disconnect("a/b?c");
    expect(calls[0]?.url).toBe("/auth/sessions/a%2Fb%3Fc");
    auth.stop();
  });
});

describe("a rotated session through the whole API", () => {
  it("keeps working after the access token is renewed", async () => {
    const { auth, calls } = makeAuth(
      "ANDROID",
      (seen) => {
        if (seen.url === "/auth/refresh") return rotated(2);
        return seen.auth === "Bearer access-2" ? ok({ user: ME }) : fail(401, "TOKEN_EXPIRED");
      },
      signedInPhone(),
    );
    await auth.start();
    expect((await auth.me()).id).toBe("u1");
    expect(calls.map((c) => c.url)).toEqual(["/auth/me", "/auth/refresh", "/auth/me"]);
    auth.stop();
  });
});
