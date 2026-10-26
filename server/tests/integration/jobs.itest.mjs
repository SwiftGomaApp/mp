import { createRequire } from "node:module";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  bootApp,
  createUser,
  prisma,
  resetState,
  shutdownApp,
  uniqueEmail,
} from "./helpers/harness.mjs";

const require = createRequire(import.meta.url);
const {
  cleanUnconfirmedSignups,
  cleanExpiredData,
  processMaintenance,
} = require("../../src/jobs/maintenance.job");

beforeAll(bootApp);
afterAll(shutdownApp);
beforeEach(resetState);

const DAY = 24 * 60 * 60 * 1000;
const ago = (ms) => new Date(Date.now() - ms);

async function pending(updatedAt) {
  const user = await prisma().user.create({
    data: { email: uniqueEmail("pending"), role: "BUYER", status: "PENDING" },
  });
  await prisma().$executeRaw`UPDATE users SET "updatedAt" = ${updatedAt} WHERE id = ${user.id}`;
  return user;
}

describe("unconfirmed signups", () => {
  it("deletes signups left unconfirmed for more than three days", async () => {
    const stale = await pending(ago(4 * DAY));
    const fresh = await pending(ago(2 * DAY));
    const active = await createUser();

    const deleted = await cleanUnconfirmedSignups();

    expect(deleted).toBe(1);
    expect(await prisma().user.findUnique({ where: { id: stale.id } })).toBeNull();
    expect(await prisma().user.findUnique({ where: { id: fresh.id } })).not.toBeNull();
    expect(await prisma().user.findUnique({ where: { id: active.id } })).not.toBeNull();
  });

  it("keeps a signup that was retried recently even if it was created long ago", async () => {
    const retried = await pending(ago(1 * DAY));
    await prisma()
      .$executeRaw`UPDATE users SET "createdAt" = ${ago(10 * DAY)} WHERE id = ${retried.id}`;
    expect(await cleanUnconfirmedSignups()).toBe(0);
  });

  it("is reachable through the job processor and rejects unknown jobs", async () => {
    await pending(ago(5 * DAY));
    await processMaintenance({ name: "cleanup.unconfirmed-signups" });
    expect(await prisma().user.count({ where: { status: "PENDING" } })).toBe(0);
    await expect(processMaintenance({ name: "nope" })).rejects.toThrow(/Unknown maintenance job/);
  });
});

describe("expired data", () => {
  async function session(userId, data) {
    return prisma().session.create({
      data: {
        userId,
        refreshTokenHash: `hash-${Math.random()}`,
        deviceId: "device-abcdef",
        platform: "ANDROID",
        authMethod: "EMAIL_OTP",
        expiresAt: new Date(Date.now() + DAY),
        ...data,
      },
    });
  }

  it("deletes old sessions but keeps live and recent ones", async () => {
    const user = await createUser();
    const oldExpired = await session(user.id, { expiresAt: ago(40 * DAY) });
    const oldRevoked = await session(user.id, { revokedAt: ago(40 * DAY) });
    const recentRevoked = await session(user.id, { revokedAt: ago(2 * DAY) });
    const live = await session(user.id, {});

    await cleanExpiredData();

    const remaining = (await prisma().session.findMany()).map((s) => s.id);
    expect(remaining).toEqual(expect.arrayContaining([recentRevoked.id, live.id]));
    expect(remaining).not.toContain(oldExpired.id);
    expect(remaining).not.toContain(oldRevoked.id);
  });

  it("deletes activity logs older than a year only", async () => {
    const user = await createUser();
    await prisma().activityLog.create({
      data: { userId: user.id, event: "LOGIN_SUCCESS", createdAt: ago(400 * DAY) },
    });
    const recent = await prisma().activityLog.create({
      data: { userId: user.id, event: "LOGIN_SUCCESS", createdAt: ago(100 * DAY) },
    });

    await cleanExpiredData();

    const logs = await prisma().activityLog.findMany({ where: { userId: user.id } });
    expect(logs.map((l) => l.id)).toEqual([recent.id]);
  });

  it("expires stale recovery requests and removes finished ones", async () => {
    const user = await createUser();
    const stale = await prisma().accountRecoveryRequest.create({
      data: { userId: user.id, status: "PENDING", expiresAt: ago(DAY), availableAt: ago(2 * DAY) },
    });
    const waiting = await prisma().accountRecoveryRequest.create({
      data: {
        userId: user.id,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 5 * DAY),
        availableAt: new Date(Date.now() + DAY),
      },
    });
    const finished = await prisma().accountRecoveryRequest.create({
      data: { userId: user.id, status: "COMPLETED", completedAt: ago(40 * DAY) },
    });
    await prisma()
      .$executeRaw`UPDATE account_recovery_requests SET "updatedAt" = ${ago(40 * DAY)} WHERE id = ${finished.id}`;

    await cleanExpiredData();

    expect(
      (await prisma().accountRecoveryRequest.findUnique({ where: { id: stale.id } })).status,
    ).toBe("EXPIRED");
    expect(
      (await prisma().accountRecoveryRequest.findUnique({ where: { id: waiting.id } })).status,
    ).toBe("PENDING");
    expect(
      await prisma().accountRecoveryRequest.findUnique({ where: { id: finished.id } }),
    ).toBeNull();
  });
});
