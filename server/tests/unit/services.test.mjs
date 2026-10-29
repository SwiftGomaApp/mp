import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { FakeRedis } from "../helpers/fakeRedis.mjs";
import { loadWithMocks } from "../helpers/mockModules.mjs";

const require = createRequire(import.meta.url);
const { AppError } = require("../../src/core/errors/AppError");

const logActivity = vi.fn(async () => undefined);
const activity = { "features/auth/services/activity.service.js": { logActivity } };

beforeEach(() => {
  logActivity.mockClear();
});

describe("security notifications", () => {
  const notify = vi.fn(async () => []);

  const { notifySecurityChange } = loadWithMocks(
    "features/auth/services/securityNotice.service.js",
    { "features/notifications/notify.js": { notify } },
  );

  beforeEach(() => notify.mockClear());

  it("raises a security alert for a user id", async () => {
    await notifySecurityChange("user-1", "PASSWORD_SET");
    expect(notify).toHaveBeenCalledWith({
      event: "security.alert",
      userId: "user-1",
      data: { type: "PASSWORD_SET", date: expect.any(String) },
    });
  });

  it("accepts a user object", async () => {
    await notifySecurityChange({ id: "user-2" }, "PASSWORD_CHANGED");
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-2" }));
  });

  it("never lets a failed alert break the action that triggered it", async () => {
    notify.mockRejectedValueOnce(new Error("boom"));
    await expect(notifySecurityChange("user-1", "X")).resolves.toBeUndefined();
  });
});

describe("step-up codes", () => {
  const queueOtpEmail = vi.fn(async () => undefined);
  const queueOtpSms = vi.fn(async () => undefined);
  const issueOtp = vi.fn(async () => ({ code: "123456", expiresMinutes: 10 }));
  const verifyOtp = vi.fn(async () => undefined);
  let redis;
  let user;
  let totp;

  const stepUp = loadWithMocks("features/auth/services/stepUp.service.js", {
    "core/db/prisma.js": {
      getPrisma: () => ({
        user: { findUnique: async () => user },
        totpCredential: { findUnique: async () => totp },
      }),
    },
    "core/cache/redis.js": { getRedis: () => redis },
    "core/auth/otp.js": { issueOtp, verifyOtp, OTP_PURPOSES: { STEP_UP: "step-up" } },
    "core/queue/notifications.js": { queueOtpEmail, queueOtpSms },
    ...activity,
  });

  beforeEach(() => {
    redis = new FakeRedis();
    totp = null;
    user = {
      id: "u1",
      name: "Alice",
      status: "ACTIVE",
      email: "a@example.com",
      emailVerifiedAt: new Date(),
      phone: "+243891234567",
      phoneVerifiedAt: new Date(),
    };
    for (const fn of [queueOtpEmail, queueOtpSms, issueOtp, verifyOtp]) fn.mockClear();
  });

  it("only works for active accounts", async () => {
    user = { ...user, status: "SUSPENDED" };
    await expect(stepUp.loadActiveUser("u1")).rejects.toMatchObject({
      status: 401,
      code: "SESSION_REVOKED",
    });
    user = null;
    await expect(stepUp.loadActiveUser("u1")).rejects.toMatchObject({ code: "SESSION_REVOKED" });
  });

  it("sends the code to the email by default and remembers where", async () => {
    const result = await stepUp.requestStepUpOtp({ userId: "u1" }, {});
    expect(result).toEqual({ channel: "EMAIL", target: "a@example.com", expiresMinutes: 10 });
    expect(issueOtp).toHaveBeenCalledWith({ purpose: "step-up:account", target: "a@example.com" });
    expect(queueOtpEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "a@example.com", code: "123456" }),
    );
    expect(await redis.get("step-up-target:account:u1")).toBe("a@example.com");
  });

  it("uses the phone when asked or when there is no email", async () => {
    const phone = await stepUp.requestStepUpOtp({ userId: "u1", channel: "PHONE" }, {});
    expect(phone.channel).toBe("PHONE");
    expect(queueOtpSms).toHaveBeenCalledWith(expect.objectContaining({ to: "+243891234567" }));

    user = { ...user, email: null, emailVerifiedAt: null };
    const fallback = await stepUp.requestStepUpOtp({ userId: "u1" }, {});
    expect(fallback.channel).toBe("PHONE");
  });

  it("refuses a channel the account cannot receive", async () => {
    user = { ...user, phoneVerifiedAt: null };
    await expect(
      stepUp.requestStepUpOtp({ userId: "u1", channel: "PHONE" }, {}),
    ).rejects.toMatchObject({
      code: "CONTACT_NOT_AVAILABLE",
    });
    expect(issueOtp).not.toHaveBeenCalled();
  });

  it("accepts the code that was sent and forgets the target", async () => {
    await stepUp.requestStepUpOtp({ userId: "u1" }, {});
    await stepUp.consumeStepUp({ id: "u1" }, "123456", {}, "password.create");

    expect(verifyOtp).toHaveBeenCalledWith({
      purpose: "step-up:account",
      target: "a@example.com",
      code: "123456",
    });
    expect(await redis.get("step-up-target:account:u1")).toBeNull();
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "STEP_UP_VERIFIED",
        metadata: { action: "password.create", factor: "OTP" },
      }),
    );
  });

  it("refuses when no code was requested", async () => {
    await expect(stepUp.consumeStepUp({ id: "u1" }, "123456", {}, "x")).rejects.toMatchObject({
      code: "OTP_INVALID",
    });
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("logs a failed code and keeps the request open for another try", async () => {
    await stepUp.requestStepUpOtp({ userId: "u1" }, {});
    verifyOtp.mockRejectedValueOnce(
      AppError.badRequest("Code invalide ou expiré", undefined, "OTP_INVALID"),
    );

    await expect(stepUp.consumeStepUp({ id: "u1" }, "000000", {}, "x")).rejects.toMatchObject({
      code: "OTP_INVALID",
    });
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ event: "OTP_FAILED", success: false }),
    );
    expect(await redis.get("step-up-target:account:u1")).toBe("a@example.com");
  });
});

describe("linking a social login to a verified email", () => {
  const assertCanLogin = vi.fn();
  const notifySecurityChange = vi.fn(async () => undefined);
  let existing;
  let sameProvider;
  const create = vi.fn(async () => ({}));

  const { linkToVerifiedAccount } = loadWithMocks("features/auth/services/oauthLink.service.js", {
    "core/db/prisma.js": {
      getPrisma: () => ({
        user: { findUnique: async () => existing },
        oAuthAccount: { findFirst: async () => sameProvider, create },
      }),
    },
    "features/auth/services/auth.service.js": { assertCanLogin },
    "features/auth/services/securityNotice.service.js": { notifySecurityChange },
    ...activity,
  });

  const identity = { providerAccountId: "sub-1", email: "a@example.com" };

  beforeEach(() => {
    existing = { id: "u1", email: "a@example.com", emailVerifiedAt: new Date(), status: "ACTIVE" };
    sameProvider = null;
    for (const fn of [assertCanLogin, notifySecurityChange, create]) fn.mockClear();
    create.mockResolvedValue({});
  });

  it("does nothing without an email from the provider", async () => {
    expect(
      await linkToVerifiedAccount(
        { provider: "APPLE", identity: { providerAccountId: "x", email: null } },
        {},
      ),
    ).toBeNull();
  });

  it("does nothing when no account has that email, or it was never verified", async () => {
    existing = null;
    expect(await linkToVerifiedAccount({ provider: "GOOGLE", identity }, {})).toBeNull();
    existing = { id: "u1", emailVerifiedAt: null, status: "ACTIVE" };
    expect(await linkToVerifiedAccount({ provider: "GOOGLE", identity }, {})).toBeNull();
    existing = { id: "u1", emailVerifiedAt: new Date(), status: "PENDING" };
    expect(await linkToVerifiedAccount({ provider: "GOOGLE", identity }, {})).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it("links, logs and alerts, then returns the account", async () => {
    const result = await linkToVerifiedAccount(
      { provider: "GOOGLE", identity },
      { ipAddress: "1.2.3.4" },
    );

    expect(result).toBe(existing);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "u1",
        provider: "GOOGLE",
        providerAccountId: "sub-1",
      }),
    });
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "OAUTH_ACCOUNT_LINKED",
        metadata: { provider: "GOOGLE", via: "verified-email" },
      }),
    );
    expect(notifySecurityChange).toHaveBeenCalledWith("u1", "LOGIN_METHOD_ADDED");
  });

  it("applies the same rules as a normal login (suspended accounts stay out)", async () => {
    assertCanLogin.mockImplementation(() => {
      throw AppError.forbidden("suspendu", "ACCOUNT_SUSPENDED");
    });
    await expect(linkToVerifiedAccount({ provider: "GOOGLE", identity }, {})).rejects.toMatchObject(
      {
        code: "ACCOUNT_SUSPENDED",
      },
    );
    expect(create).not.toHaveBeenCalled();
    assertCanLogin.mockReset();
  });

  it("refuses a second account from the same provider", async () => {
    sameProvider = { id: "link-1" };
    await expect(linkToVerifiedAccount({ provider: "GOOGLE", identity }, {})).rejects.toMatchObject(
      {
        status: 409,
        code: "OAUTH_METHOD_ALREADY_LINKED",
      },
    );
  });

  it("reports a race where the identity was linked elsewhere in the meantime", async () => {
    create.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "P2002" }));
    await expect(linkToVerifiedAccount({ provider: "APPLE", identity }, {})).rejects.toMatchObject({
      status: 409,
      code: "OAUTH_ACCOUNT_ALREADY_LINKED",
    });
  });
});

describe("suspending accounts", () => {
  const revokeUserSessions = vi.fn(async () => []);
  const update = vi.fn(async () => ({}));
  const closeRequests = vi.fn(async () => ({ count: 1 }));
  let target;

  const status = loadWithMocks("features/auth/services/accountStatus.service.js", {
    "core/db/prisma.js": {
      getPrisma: () => ({
        user: { findUnique: async () => target, update },
        supportRequest: { updateMany: closeRequests },
      }),
    },
    "features/auth/services/session.service.js": { revokeUserSessions },
    ...activity,
  });

  beforeEach(() => {
    target = { id: "u2", status: "ACTIVE" };
    for (const fn of [revokeUserSessions, update, closeRequests]) fn.mockClear();
  });

  it("suspends, closes every session and records who did it and why", async () => {
    await status.suspendAccount(
      { userId: "u2", actorId: "admin", reason: "Fraude" },
      { ipAddress: "1.1.1.1" },
    );

    expect(update).toHaveBeenCalledWith({ where: { id: "u2" }, data: { status: "SUSPENDED" } });
    expect(revokeUserSessions).toHaveBeenCalledWith("u2", { reason: "SUSPENDED" });
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u2",
        event: "ACCOUNT_SUSPENDED",
        metadata: { actorId: "admin", reason: "Fraude", previousStatus: "ACTIVE" },
      }),
    );
  });

  it("bans with its own reason code", async () => {
    await status.banAccount({ userId: "u2", actorId: "admin", reason: "Abus" }, {});
    expect(revokeUserSessions).toHaveBeenCalledWith("u2", { reason: "BANNED" });
    expect(update).toHaveBeenCalledWith({ where: { id: "u2" }, data: { status: "BANNED" } });
  });

  it("never acts on the actor's own account", async () => {
    await expect(
      status.suspendAccount({ userId: "admin", actorId: "admin", reason: "x" }, {}),
    ).rejects.toMatchObject({ status: 403, code: "SELF_ACTION" });
    expect(update).not.toHaveBeenCalled();
  });

  it("does not find missing or deleted accounts", async () => {
    target = null;
    await expect(
      status.banAccount({ userId: "u2", actorId: "a", reason: "x" }, {}),
    ).rejects.toMatchObject({
      status: 404,
    });
    target = { id: "u2", status: "DELETED" };
    await expect(
      status.banAccount({ userId: "u2", actorId: "a", reason: "x" }, {}),
    ).rejects.toMatchObject({
      status: 404,
    });
  });

  it("reactivates only suspended or banned accounts and closes their open requests", async () => {
    await expect(
      status.reactivateAccount({ userId: "u2", actorId: "a", reason: "x" }, {}),
    ).rejects.toMatchObject({
      code: "ACCOUNT_NOT_SUSPENDED",
    });

    target = { id: "u2", status: "BANNED" };
    await status.reactivateAccount({ userId: "u2", actorId: "admin", reason: "Erreur" }, {});

    expect(update).toHaveBeenCalledWith({ where: { id: "u2" }, data: { status: "ACTIVE" } });
    expect(revokeUserSessions).not.toHaveBeenCalled();
    expect(closeRequests).toHaveBeenCalledWith({
      where: { userId: "u2", status: "OPEN" },
      data: expect.objectContaining({
        status: "CLOSED",
        closedBy: "admin",
        note: "Compte réactivé",
      }),
    });
  });
});

describe("support requests from suspended accounts", () => {
  const create = vi.fn(async () => ({}));
  const findFirst = vi.fn();
  const findUser = vi.fn();

  const support = loadWithMocks("features/auth/services/supportRequest.service.js", {
    "core/db/prisma.js": {
      getPrisma: () => ({
        user: { findFirst: findUser },
        supportRequest: { findFirst, create },
      }),
    },
    ...activity,
  });

  beforeEach(() => {
    for (const fn of [create, findFirst, findUser]) fn.mockReset();
    findFirst.mockResolvedValue(null);
  });

  it("looks the account up by email or by phone", async () => {
    findUser.mockResolvedValue(null);
    await support.createSupportRequest({ email: "a@example.com", message: "m" }, {});
    await support.createSupportRequest({ phone: "+243891234567", message: "m" }, {});
    expect(findUser.mock.calls[0][0].where).toEqual({ email: "a@example.com" });
    expect(findUser.mock.calls[1][0].where).toEqual({ phone: "+243891234567" });
  });

  it("answers the same for every outcome", async () => {
    const answers = [];
    for (const found of [null, { id: "u1", status: "ACTIVE" }, { id: "u1", status: "SUSPENDED" }]) {
      findUser.mockResolvedValue(found);
      answers.push(
        await support.createSupportRequest({ email: "a@example.com", message: "m" }, {}),
      );
    }
    expect(answers[1]).toEqual(answers[0]);
    expect(answers[2]).toEqual(answers[0]);
  });

  it("stores a request only for suspended or banned accounts", async () => {
    findUser.mockResolvedValue({ id: "u1", status: "ACTIVE" });
    await support.createSupportRequest({ email: "a@example.com", message: "m" }, {});
    findUser.mockResolvedValue(null);
    await support.createSupportRequest({ email: "a@example.com", message: "m" }, {});
    expect(create).not.toHaveBeenCalled();

    for (const status of ["SUSPENDED", "BANNED"]) {
      findUser.mockResolvedValue({ id: "u1", status });
      await support.createSupportRequest(
        { email: "a@example.com", message: "Bonjour" },
        { ipAddress: "9.9.9.9" },
      );
    }
    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledWith({
      data: { userId: "u1", message: "Bonjour", ipAddress: "9.9.9.9" },
    });
  });

  it("does not store a second request while one is open from the last 24 hours", async () => {
    findUser.mockResolvedValue({ id: "u1", status: "SUSPENDED" });
    findFirst.mockResolvedValue({ id: "r1" });
    await support.createSupportRequest({ email: "a@example.com", message: "m" }, {});
    expect(create).not.toHaveBeenCalled();
    expect(findFirst.mock.calls[0][0].where).toMatchObject({ userId: "u1", status: "OPEN" });
  });

  it("closes a request once, with who closed it", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const findUnique = vi.fn(async () => ({ userId: "u1" }));
    const closing = loadWithMocks("features/auth/services/supportRequest.service.js", {
      "core/db/prisma.js": { getPrisma: () => ({ supportRequest: { updateMany, findUnique } }) },
      ...activity,
    });

    expect(
      await closing.closeSupportRequest({ actorId: "admin", id: "r1", note: "ok" }, {}),
    ).toEqual({
      id: "r1",
      status: "CLOSED",
    });
    expect(updateMany.mock.calls[0][0].where).toEqual({ id: "r1", status: "OPEN" });

    updateMany.mockResolvedValue({ count: 0 });
    await expect(
      closing.closeSupportRequest({ actorId: "admin", id: "r1" }, {}),
    ).rejects.toMatchObject({
      status: 404,
    });
  });
});
