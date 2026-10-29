import { describe, expect, it, vi } from "vitest";
import { PasskeysDisabledError, SocialLoginDisabledError } from "../src/index";
import { USER, fail, makeAuth, ok } from "./helpers";
import type { Reply, Seen } from "./helpers";

const NONCE = "n".repeat(40);

const phoneSession = (extra: object = {}): Reply =>
  ok({
    user: USER,
    accessToken: "access-1",
    refreshToken: "refresh-1",
    isNewDevice: false,
    ...extra,
  });

// Answers the nonce call, and everything else with the given reply.
const withNonce =
  (reply: Reply) =>
  (seen: Seen): Reply =>
    seen.url === "/auth/oauth/nonce" ? ok({ nonce: NONCE }) : reply;

const google = () => ({ getIdToken: vi.fn(async (nonce: string) => `google-token-for-${nonce}`) });
const apple = () => ({ getIdToken: vi.fn(async (nonce: string) => `apple-token-for-${nonce}`) });

describe("social sign-in", () => {
  it("gets a nonce, gives it to the provider and sends token and nonce", async () => {
    const provider = google();
    const { auth, calls } = makeAuth(
      "ANDROID",
      withNonce(phoneSession()),
      {},
      {
        socials: { google: provider },
      },
    );
    const result = await auth.login.google();

    expect(result).toEqual({ status: "authenticated", user: USER, isNewDevice: false });
    expect(provider.getIdToken).toHaveBeenCalledWith(NONCE);
    expect(calls.map((c) => c.url)).toEqual(["/auth/oauth/nonce", "/auth/login/google"]);
    expect(calls[1]?.body).toMatchObject({
      idToken: `google-token-for-${NONCE}`,
      nonce: NONCE,
      device: { platform: "ANDROID" },
    });
    expect(auth.session.getState().status).toBe("authenticated");
  });

  it("signs in with Apple", async () => {
    const { auth, calls } = makeAuth(
      "IOS",
      withNonce(phoneSession()),
      {},
      {
        socials: { apple: apple() },
      },
    );
    await auth.login.apple();
    expect(calls[1]?.url).toBe("/auth/login/apple");
  });

  it("works in a browser with cookies", async () => {
    const { auth } = makeAuth(
      "WEB",
      withNonce(ok({ user: USER, isNewDevice: true })),
      {},
      {
        socials: { google: google() },
      },
    );
    expect(await auth.login.google()).toMatchObject({ status: "authenticated", isNewDevice: true });
    expect(await auth.session.getAccessToken()).toBeNull();
  });

  it("can end in a second step", async () => {
    const { auth } = makeAuth(
      "ANDROID",
      withNonce({
        status: 202,
        data: { twoFactorRequired: true, challengeToken: "c".repeat(40), expiresIn: 300 },
      }),
      {},
      { socials: { google: google() } },
    );
    expect(await auth.login.google()).toEqual({
      status: "twoFactorRequired",
      expiresInSeconds: 300,
    });
  });

  it("signs up with Google and a role", async () => {
    const { auth, calls } = makeAuth(
      "ANDROID",
      withNonce(phoneSession()),
      {},
      {
        socials: { google: google() },
      },
    );
    await auth.signup.google({ role: "SELLER", acceptTerms: true, confirmAge: true });

    expect(calls[1]?.url).toBe("/auth/signup/google");
    expect(calls[1]?.body).toMatchObject({
      idToken: `google-token-for-${NONCE}`,
      nonce: NONCE,
      role: "SELLER",
      acceptTerms: true,
      confirmAge: true,
    });
  });

  it("signs up with Apple and the name Apple gave", async () => {
    const { auth, calls } = makeAuth(
      "IOS",
      withNonce(phoneSession()),
      {},
      {
        socials: { apple: apple() },
      },
    );
    await auth.signup.apple({ role: "BUYER", acceptTerms: true, confirmAge: true, name: "Gael B" });
    expect(calls[1]?.url).toBe("/auth/signup/apple");
    expect(calls[1]?.body).toMatchObject({ name: "Gael B", role: "BUYER" });
  });

  it("says which providers the app gave", () => {
    expect(makeAuth("ANDROID", () => ok()).auth.socials.enabled).toEqual({
      google: false,
      apple: false,
    });
    expect(
      makeAuth("ANDROID", () => ok(), {}, { socials: { google: google() } }).auth.socials.enabled,
    ).toEqual({ google: true, apple: false });
  });

  it("refuses a provider the app did not give, before any request", async () => {
    const { auth, calls } = makeAuth(
      "ANDROID",
      withNonce(phoneSession()),
      {},
      {
        socials: { google: google() },
      },
    );
    const error = await auth.login.apple().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SocialLoginDisabledError);
    expect(error).toMatchObject({ code: "SOCIAL_LOGIN_DISABLED", details: { provider: "apple" } });
    await expect(
      auth.signup.apple({ role: "BUYER", acceptTerms: true, confirmAge: true }),
    ).rejects.toBeInstanceOf(SocialLoginDisabledError);
    expect(calls).toHaveLength(0);
  });

  it("lets the provider fail, for example when the user cancels", async () => {
    const provider = { getIdToken: vi.fn(() => Promise.reject(new Error("user cancelled"))) };
    const { auth, calls } = makeAuth(
      "ANDROID",
      withNonce(phoneSession()),
      {},
      {
        socials: { google: provider },
      },
    );
    await expect(auth.login.google()).rejects.toThrow("user cancelled");
    expect(calls.map((c) => c.url)).toEqual(["/auth/oauth/nonce"]);
  });

  it("refuses an empty ID token", async () => {
    const provider = { getIdToken: vi.fn(async () => "") };
    const { auth } = makeAuth(
      "ANDROID",
      withNonce(phoneSession()),
      {},
      { socials: { google: provider } },
    );
    await expect(auth.login.google()).rejects.toThrow(TypeError);
  });

  it("passes the server refusals through", async () => {
    const { auth } = makeAuth(
      "ANDROID",
      withNonce(fail(401, "GOOGLE_NONCE_INVALID")),
      {},
      {
        socials: { google: google() },
      },
    );
    await expect(auth.login.google()).rejects.toMatchObject({
      code: "GOOGLE_NONCE_INVALID",
      status: 401,
    });
  });

  it("refuses a nonce answer without a nonce", async () => {
    const { auth } = makeAuth("ANDROID", () => ok({}), {}, { socials: { google: google() } });
    await expect(auth.login.google()).rejects.toMatchObject({ code: "UNKNOWN_ERROR" });
  });
});

describe("passkey sign-in", () => {
  const options = { challenge: "abc", rpId: "swiftgoma.com", userVerification: "required" };
  const assertion = {
    id: "cred-1",
    rawId: "cred-1",
    type: "public-key",
    response: { signature: "s" },
  };

  const passkeyServer =
    (verify: Reply) =>
    (seen: Seen): Reply =>
      seen.url === "/auth/login/passkey/options"
        ? ok({ challengeId: "x".repeat(40), options })
        : verify;

  it("fetches options, asks the device and sends the assertion", async () => {
    const provider = {
      createCredential: vi.fn(),
      getAssertion: vi.fn(async () => assertion),
    };
    const { auth, calls } = makeAuth(
      "ANDROID",
      passkeyServer(phoneSession()),
      {},
      {
        passkeys: provider,
      },
    );
    const result = await auth.login.passkey();

    expect(result).toEqual({ status: "authenticated", user: USER, isNewDevice: false });
    expect(provider.getAssertion).toHaveBeenCalledWith(options);
    expect(calls.map((c) => c.url)).toEqual([
      "/auth/login/passkey/options",
      "/auth/login/passkey/verify",
    ]);
    expect(calls[1]?.body).toMatchObject({
      challengeId: "x".repeat(40),
      response: assertion,
      device: { platform: "ANDROID" },
    });
  });

  it("works in a browser", async () => {
    const { auth } = makeAuth(
      "WEB",
      passkeyServer(ok({ user: USER, isNewDevice: false })),
      {},
      {
        passkeys: { createCredential: vi.fn(), getAssertion: async () => assertion },
      },
    );
    expect((await auth.login.passkey()).status).toBe("authenticated");
  });

  it("refuses when the app gave no passkey provider, before any request", async () => {
    const { auth, calls } = makeAuth("ANDROID", passkeyServer(phoneSession()));
    await expect(auth.login.passkey()).rejects.toBeInstanceOf(PasskeysDisabledError);
    expect(calls).toHaveLength(0);
  });

  it("lets the device fail, for example when the user cancels", async () => {
    const { auth, calls } = makeAuth(
      "ANDROID",
      passkeyServer(phoneSession()),
      {},
      {
        passkeys: {
          createCredential: vi.fn(),
          getAssertion: () => Promise.reject(new Error("NotAllowedError")),
        },
      },
    );
    await expect(auth.login.passkey()).rejects.toThrow("NotAllowedError");
    expect(calls).toHaveLength(1);
  });

  it("refuses an options answer that is not usable", async () => {
    const { auth } = makeAuth(
      "ANDROID",
      () => ok({ challengeId: "x" }),
      {},
      {
        passkeys: { createCredential: vi.fn(), getAssertion: async () => assertion },
      },
    );
    await expect(auth.login.passkey()).rejects.toMatchObject({ code: "UNKNOWN_ERROR" });
  });

  it("passes the server refusals through", async () => {
    const { auth } = makeAuth(
      "ANDROID",
      passkeyServer(fail(401, "PASSKEY_INVALID")),
      {},
      {
        passkeys: { createCredential: vi.fn(), getAssertion: async () => assertion },
      },
    );
    await expect(auth.login.passkey()).rejects.toMatchObject({ code: "PASSKEY_INVALID" });
  });
});
