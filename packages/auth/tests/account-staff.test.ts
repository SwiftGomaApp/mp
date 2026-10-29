import { describe, expect, it, vi } from "vitest";
import { PasskeysDisabledError, SocialLoginDisabledError } from "../src/index";
import { createAccount } from "../src/account/index";
import { createStaff } from "../src/staff/index";
import { createServerClient, fetchCurrentUser } from "../src/web/server/index";
import { fail, fakeServer, makeAuth, ok, savedPhoneSession } from "./helpers";
import type { Reply, Seen } from "./helpers";

const signedIn = () => savedPhoneSession(Date.now() + 600_000);

async function account(
  answer: (seen: Seen) => Reply,
  options: Parameters<typeof createAccount>[1] = {},
) {
  const harness = makeAuth("ANDROID", answer, signedIn());
  await harness.auth.start();
  return { ...harness, account: createAccount(harness.auth, options) };
}

const sent = (calls: Seen[], index = 0) => ({
  method: calls[index]?.method,
  url: calls[index]?.url,
  body: calls[index]?.body,
  auth: calls[index]?.auth,
});

describe("account: two-step verification", () => {
  it("reads the status", async () => {
    const { account: a, calls } = await account(() =>
      ok({ enabled: true, mandatory: false, backupCodesRemaining: 8 }),
    );
    expect(await a.twoFactor.status()).toEqual({
      enabled: true,
      mandatory: false,
      backupCodesRemaining: 8,
    });
    expect(sent(calls)).toMatchObject({ method: "get", url: "/auth/2fa", auth: "Bearer access-1" });
  });

  it("sets up and confirms with a step-up code", async () => {
    const { account: a, calls } = await account((seen) =>
      seen.url === "/auth/2fa/setup"
        ? ok({ secret: "JBSWY3DP", otpauthUri: "otpauth://totp/x" })
        : ok({ backupCodes: ["AAAA-1111"] }),
    );
    expect(await a.twoFactor.setup()).toEqual({
      secret: "JBSWY3DP",
      otpauthUri: "otpauth://totp/x",
    });
    expect(await a.twoFactor.confirm({ code: "123456", stepUpCode: "654321" })).toEqual({
      backupCodes: ["AAAA-1111"],
    });
    expect(calls[1]?.body).toEqual({ code: "123456", stepUpCode: "654321" });
  });

  it("disables it and makes new backup codes with an app code or a backup code", async () => {
    const { account: a, calls } = await account((seen) =>
      seen.url === "/auth/2fa/disable"
        ? ok({ enabled: false })
        : ok({ backupCodes: ["BBBB-2222"] }),
    );
    expect(await a.twoFactor.disable({ code: "123456" })).toEqual({ enabled: false });
    await a.twoFactor.regenerateBackupCodes({ backupCode: "ABCD-EFGH" });
    expect(calls[0]?.body).toEqual({ code: "123456" });
    expect(calls[1]?.body).toEqual({ backupCode: "ABCD-EFGH" });
    expect(calls[1]?.url).toBe("/auth/2fa/backup-codes");
  });
});

describe("account: passkeys", () => {
  const credential = { id: "c1", rawId: "c1", type: "public-key", response: {} };
  const passkey = {
    id: "p1",
    name: "Pixel",
    deviceId: null,
    algorithm: "ES256",
    createdAt: "2026-10-01T10:00:00.000Z",
    lastUsedAt: null,
  };

  it("lists, renames and removes", async () => {
    const { account: a, calls } = await account((seen) => {
      if (seen.method === "get") return ok({ passkeys: [passkey] });
      if (seen.method === "patch") return ok({ id: "p1", name: "Work phone" });
      return { status: 204 };
    });
    expect(await a.passkeys.list()).toEqual([passkey]);
    expect(await a.passkeys.rename("p1", "Work phone")).toEqual({ id: "p1", name: "Work phone" });
    await a.passkeys.remove("p1");
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ["get", "/auth/passkeys"],
      ["patch", "/auth/passkeys/p1"],
      ["delete", "/auth/passkeys/p1"],
    ]);
  });

  it("asks the device for a credential and registers it", async () => {
    const createCredential = vi.fn(async () => credential);
    const { account: a, calls } = await account(
      (seen) =>
        seen.url === "/auth/passkeys/options"
          ? ok({ challenge: "abc" })
          : { status: 201, data: { passkey } },
      { passkeys: { createCredential, getAssertion: vi.fn() } },
    );
    expect(await a.passkeys.register({ stepUpCode: "654321", name: "Pixel" })).toEqual(passkey);

    expect(createCredential).toHaveBeenCalledWith({ challenge: "abc" });
    expect(calls[1]?.body).toEqual({ response: credential, stepUpCode: "654321", name: "Pixel" });
  });

  it("refuses to register without a passkey provider, before any request", async () => {
    const { account: a, calls } = await account(() => ok());
    await expect(a.passkeys.register({ stepUpCode: "654321" })).rejects.toBeInstanceOf(
      PasskeysDisabledError,
    );
    expect(calls).toHaveLength(0);
  });

  it("returns an empty list when the answer has none", async () => {
    const { account: a } = await account(() => ok({}));
    expect(await a.passkeys.list()).toEqual([]);
  });
});

describe("account: linking a provider", () => {
  const NONCE = "n".repeat(40);
  const server = (seen: Seen): Reply =>
    seen.url === "/auth/oauth/nonce"
      ? ok({ nonce: NONCE })
      : ok({ linked: true, alreadyLinked: false });

  it("links Google with the token and the step-up code", async () => {
    const getIdToken = vi.fn(async (nonce: string) => `google-${nonce}`);
    const { account: a, calls } = await account(server, { socials: { google: { getIdToken } } });
    expect(await a.link.google({ stepUpCode: "654321" })).toEqual({ alreadyLinked: false });

    expect(calls.map((c) => c.url)).toEqual(["/auth/oauth/nonce", "/auth/google/link"]);
    expect(calls[1]?.body).toEqual({ idToken: `google-${NONCE}`, stepUpCode: "654321" });
  });

  it("links Apple with the nonce too, and says when it was already linked", async () => {
    const { account: a, calls } = await account(
      (seen) =>
        seen.url === "/auth/oauth/nonce"
          ? ok({ nonce: NONCE })
          : ok({ linked: true, alreadyLinked: true }),
      { socials: { apple: { getIdToken: async (nonce) => `apple-${nonce}` } } },
    );
    expect(await a.link.apple({ stepUpCode: "654321" })).toEqual({ alreadyLinked: true });
    expect(calls[1]?.body).toEqual({
      idToken: `apple-${NONCE}`,
      nonce: NONCE,
      stepUpCode: "654321",
    });
  });

  it("refuses a provider the app did not give", async () => {
    const { account: a, calls } = await account(server);
    await expect(a.link.google({ stepUpCode: "654321" })).rejects.toBeInstanceOf(
      SocialLoginDisabledError,
    );
    expect(calls).toHaveLength(0);
  });
});

describe("account: sign-in methods and recovery contacts", () => {
  const methods = {
    email: { value: "gael@example.com", verified: true },
    phone: null,
    password: true,
    google: null,
    apple: null,
    passkeys: 1,
  };

  it("lists and removes sign-in methods", async () => {
    const { account: a, calls } = await account(() => ok(methods));
    expect(await a.methods.list()).toEqual(methods);
    await a.methods.remove("GOOGLE", { code: "654321" });
    expect(sent(calls, 1)).toMatchObject({
      method: "post",
      url: "/auth/methods/GOOGLE/remove",
      body: { code: "654321" },
    });
  });

  it("adds, verifies and removes a recovery contact", async () => {
    const contacts = {
      secondaryEmail: null,
      secondaryEmailVerifiedAt: null,
      secondaryPhone: null,
      secondaryPhoneVerifiedAt: null,
    };
    const { account: a, calls } = await account((seen) => {
      if (seen.url === "/auth/secondary-contacts/otp") {
        return ok({
          message: "Un code de vérification a été envoyé",
          kind: "EMAIL",
          contact: "b@x.com",
          expiresMinutes: 10,
        });
      }
      if (seen.url === "/auth/secondary-contacts/verify") {
        return ok({ message: "ok", kind: "EMAIL", contact: "b@x.com", verified: true });
      }
      return ok(contacts);
    });
    const request = { kind: "EMAIL" as const, value: "b@x.com", stepUpCode: "654321" };
    expect((await a.recoveryContacts.requestCode(request)).expiresMinutes).toBe(10);
    expect(
      (await a.recoveryContacts.verify({ kind: "EMAIL", value: "b@x.com", code: "123456" }))
        .verified,
    ).toBe(true);
    expect(await a.recoveryContacts.remove({ kind: "EMAIL", stepUpCode: "654321" })).toEqual(
      contacts,
    );
    expect(await a.recoveryContacts.list()).toEqual(contacts);
    expect(calls.map((c) => c.url)).toEqual([
      "/auth/secondary-contacts/otp",
      "/auth/secondary-contacts/verify",
      "/auth/secondary-contacts/remove",
      "/auth/secondary-contacts",
    ]);
  });
});

describe("account: recovery", () => {
  it("runs the five steps", async () => {
    const { account: a, calls } = await account((seen) => {
      switch (seen.url) {
        case "/auth/recovery/request":
          return ok({ message: "Si un compte existe..." });
        case "/auth/recovery/verify":
          return ok({ recoveryToken: "t".repeat(40), availableAt: "2026-11-01T10:00:00.000Z" });
        case "/auth/recovery/contact":
          return ok({
            message: "Un code",
            kind: "EMAIL",
            contact: "new@x.com",
            expiresMinutes: 10,
          });
        case "/auth/recovery/complete":
          return ok({ recovered: true });
        default:
          return ok({ cancelled: true });
      }
    });

    await a.recovery.request({ email: "gael@example.com" });
    const verified = await a.recovery.verify({ email: "gael@example.com", code: "123456" });
    expect(verified.availableAt).toBe("2026-11-01T10:00:00.000Z");
    await a.recovery.setNewContact({
      token: verified.recoveryToken,
      kind: "EMAIL",
      value: "new@x.com",
    });
    expect(
      await a.recovery.complete({
        token: verified.recoveryToken,
        kind: "EMAIL",
        value: "new@x.com",
        code: "123456",
      }),
    ).toEqual({ recovered: true });
    expect(await a.recovery.cancel()).toEqual({ cancelled: true });
    expect(calls).toHaveLength(5);
  });

  it("tells a recovery that is still waiting", async () => {
    const { account: a } = await account(() =>
      fail(403, "RECOVERY_WAITING", { details: { availableAt: "2026-11-01T10:00:00.000Z" } }),
    );
    await expect(
      a.recovery.complete({
        token: "t".repeat(40),
        kind: "EMAIL",
        value: "n@x.com",
        code: "123456",
      }),
    ).rejects.toMatchObject({
      code: "RECOVERY_WAITING",
      details: { availableAt: "2026-11-01T10:00:00.000Z" },
    });
  });
});

describe("account: activity, security and support", () => {
  it("reads the activity with its filters", async () => {
    const page = { items: [], page: 2, limit: 10, total: 0 };
    const { account: a, calls } = await account(() => ok(page));
    expect(await a.activity({ page: 2, limit: 10, category: "SECURITY" })).toEqual(page);
    expect(calls[0]?.url).toBe("/auth/activity");
  });

  it("reads the security checklist", async () => {
    const checklist = { items: [{ key: "TWO_FACTOR", done: false }], pendingRecovery: null };
    const { account: a } = await account(() => ok(checklist));
    expect(await a.security()).toEqual(checklist);
  });

  it("asks Support for help without a session", async () => {
    const { auth, calls } = makeAuth("ANDROID", () => ({
      status: 202,
      data: { message: "Votre demande a été envoyée" },
    }));
    const a = createAccount(auth);
    expect(
      await a.supportRequest({ email: "gael@example.com", message: "Mon compte est suspendu" }),
    ).toEqual({
      message: "Votre demande a été envoyée",
    });
    expect(sent(calls)).toMatchObject({
      method: "post",
      url: "/auth/support-request",
      auth: undefined,
    });
  });

  it("refuses a body that is not a record", async () => {
    const { account: a } = await account(() => ok("oops"));
    await expect(a.security()).rejects.toMatchObject({ code: "UNKNOWN_ERROR" });
  });
});

describe("staff", () => {
  async function staff(answer: (seen: Seen) => Reply) {
    const harness = makeAuth("ANDROID", answer, signedIn());
    await harness.auth.start();
    return { ...harness, staff: createStaff(harness.auth) };
  }

  it("creates a Support account", async () => {
    const created = {
      id: "u9",
      name: "Awa",
      email: "awa@x.com",
      role: "SUPPORT",
      status: "PENDING",
    };
    const { staff: s, calls } = await staff(() => ({ status: 201, data: created }));
    expect(await s.create({ name: "Awa", email: "awa@x.com", code: "123456" })).toEqual(created);
    expect(sent(calls)).toMatchObject({
      url: "/auth/staff",
      body: { name: "Awa", email: "awa@x.com", code: "123456" },
    });
  });

  it("finishes the setup from the link, resends it, and resets two-step", async () => {
    const { staff: s, calls } = await staff((seen) =>
      seen.url.endsWith("/reset-2fa")
        ? ok({ id: "u9", twoFactorEnabled: false })
        : ok({ message: "ok" }),
    );
    await s.setup({ token: "t".repeat(40), newPassword: "new12345" });
    await s.resendSetup("u9", { code: "123456" });
    expect(await s.resetTwoFactor("u9", { code: "123456", reason: "Téléphone perdu" })).toEqual({
      id: "u9",
      twoFactorEnabled: false,
    });
    expect(calls.map((c) => c.url)).toEqual([
      "/auth/staff/setup",
      "/auth/staff/u9/resend-setup",
      "/auth/staff/u9/reset-2fa",
    ]);
  });

  it("lists and closes support requests", async () => {
    const page = { items: [], page: 1, limit: 20, total: 0 };
    const { staff: s, calls } = await staff((seen) =>
      seen.method === "get" ? ok(page) : ok({ id: "r1", status: "CLOSED" }),
    );
    expect(await s.supportRequests.list({ status: "OPEN" })).toEqual(page);
    expect(await s.supportRequests.close("r1", { note: "Traité" })).toEqual({
      id: "r1",
      status: "CLOSED",
    });
    expect(calls[1]).toMatchObject({
      url: "/auth/support-requests/r1/close",
      body: { note: "Traité" },
    });
  });

  it("passes a refused role through as a typed error", async () => {
    const { staff: s } = await staff(() => fail(403, "FORBIDDEN"));
    await expect(s.supportRequests.close("r1")).rejects.toMatchObject({ status: 403 });
  });
});

describe("server rendering helper", () => {
  it("forwards the visitor cookies and reads the account", async () => {
    const user = { id: "u1", name: "Gael" };
    const { transport, calls } = fakeServer(() => ok({ user }));
    const client = createServerClient({
      baseUrl: "https://app.example.com",
      cookie: "__Host-swg_access=abc; swg_refresh=def",
      origin: "https://app.example.com",
      transport,
    });
    expect(await fetchCurrentUser(client)).toEqual(user);
    expect(calls[0]?.url).toBe("/auth/me");
  });

  it("sends the Cookie header", async () => {
    let seenHeaders: Record<string, unknown> = {};
    const client = createServerClient({
      baseUrl: "https://app.example.com",
      cookie: "a=1",
      origin: "https://app.example.com",
      transport: (config) => {
        seenHeaders = {
          cookie: config.headers.get("Cookie"),
          origin: config.headers.get("Origin"),
        };
        return Promise.resolve({
          status: 200,
          statusText: "",
          data: { user: null },
          headers: {},
          config,
        });
      },
    });
    await client.get("/auth/me");
    expect(seenHeaders).toEqual({ cookie: "a=1", origin: "https://app.example.com" });
  });

  it("gives null for a visitor who is not signed in, and throws other failures", async () => {
    const anonymous = createServerClient({
      baseUrl: "https://app.example.com",
      cookie: undefined,
      transport: fakeServer(() => fail(401, "UNAUTHORIZED")).transport,
    });
    expect(await fetchCurrentUser(anonymous)).toBeNull();

    const broken = createServerClient({
      baseUrl: "https://app.example.com",
      cookie: "a=1",
      transport: fakeServer(() => fail(500, "INTERNAL_ERROR")).transport,
    });
    await expect(fetchCurrentUser(broken)).rejects.toMatchObject({ status: 500 });
  });
});
