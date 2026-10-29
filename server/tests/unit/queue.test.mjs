import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadWithMocks } from "../helpers/mockModules.mjs";

const add = vi.fn(async () => ({ id: "1" }));
const upsertJobScheduler = vi.fn(async () => undefined);
const assertSmsBudget = vi.fn(async () => undefined);

const queues = {
  QUEUES: { NOTIFICATIONS: "notifications", MAINTENANCE: "maintenance" },
  getQueue: vi.fn(() => ({ add, upsertJobScheduler })),
};

const notifications = loadWithMocks("core/queue/notifications.js", {
  "core/queue/queues.js": queues,
  "core/messaging/smsBudget.js": { assertSmsBudget },
});

beforeEach(() => {
  add.mockClear();
  upsertJobScheduler.mockClear();
  assertSmsBudget.mockReset();
  assertSmsBudget.mockResolvedValue(undefined);
});

describe("notification queue", () => {
  it.each([
    ["queueOtpEmail", "email.otp"],
    ["queueWelcomeEmail", "email.welcome"],
    ["queueWelcomeSms", "sms.welcome"],
    ["queueLoginAlertSms", "sms.login-alert"],
    ["queueSecurityAlertSms", "sms.security-alert"],
    ["queueStaffSetupEmail", "email.staff-setup"],
  ])("%s queues a %s job with its data", async (fn, name) => {
    const data = { to: "a@example.com" };
    await notifications[fn](data);
    expect(queues.getQueue).toHaveBeenCalledWith("notifications");
    expect(add).toHaveBeenCalledWith(name, data);
  });

  it("converts dates to text so they survive the queue", async () => {
    const date = new Date("2026-10-26T10:30:00Z");
    await notifications.queueLoginAlertEmail({ to: "a@example.com", date });
    await notifications.queueSecurityAlertEmail({ to: "a@example.com", type: "X", date });
    expect(add.mock.calls[0]).toEqual([
      "email.login-alert",
      { to: "a@example.com", date: "2026-10-26T10:30:00.000Z" },
    ]);
    expect(add.mock.calls[1][1].date).toBe("2026-10-26T10:30:00.000Z");
  });

  it("uses the current time when no date is given", async () => {
    await notifications.queueLoginAlertEmail({ to: "a@example.com" });
    const queued = new Date(add.mock.calls[0][1].date).getTime();
    expect(Math.abs(queued - Date.now())).toBeLessThan(5000);
  });

  it("checks the daily SMS budget before queueing a code SMS", async () => {
    await notifications.queueOtpSms({ to: "+243891234567", code: "123456" });
    expect(assertSmsBudget).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith("sms.otp", { to: "+243891234567", code: "123456" });
  });

  it("queues nothing when the budget is used up", async () => {
    assertSmsBudget.mockRejectedValue(new Error("budget"));
    await expect(notifications.queueOtpSms({ to: "+243891234567", code: "1" })).rejects.toThrow(
      "budget",
    );
    expect(add).not.toHaveBeenCalled();
  });

  it("does not spend the SMS budget on emails or alerts", async () => {
    await notifications.queueOtpEmail({ to: "a@example.com" });
    await notifications.queueLoginAlertSms({ to: "+243891234567" });
    expect(assertSmsBudget).not.toHaveBeenCalled();
  });
});

describe("notification handlers", () => {
  const mail = {
    sendOtpEmail: vi.fn(),
    sendLoginAlertEmail: vi.fn(),
    sendWelcomeEmail: vi.fn(),
    sendSecurityAlertEmail: vi.fn(),
    sendStaffSetupEmail: vi.fn(),
  };
  const sms = {
    sendOtpSms: vi.fn(),
    sendLoginAlertSms: vi.fn(),
    sendWelcomeSms: vi.fn(),
    sendSecurityAlertSms: vi.fn(),
  };
  const { processNotification } = loadWithMocks("jobs/notifications.job.js", {
    "core/mail/mail.service.js": mail,
    "core/messaging/sms.service.js": sms,
  });

  beforeEach(() => {
    for (const fn of [...Object.values(mail), ...Object.values(sms)]) fn.mockReset();
  });

  it.each([
    ["email.otp", "sendOtpEmail", mail],
    ["email.welcome", "sendWelcomeEmail", mail],
    ["email.staff-setup", "sendStaffSetupEmail", mail],
    ["sms.otp", "sendOtpSms", sms],
    ["sms.login-alert", "sendLoginAlertSms", sms],
    ["sms.welcome", "sendWelcomeSms", sms],
    ["sms.security-alert", "sendSecurityAlertSms", sms],
  ])("sends %s through %s", async (name, method, target) => {
    const data = { to: "x" };
    await processNotification({ name, data });
    expect(target[method]).toHaveBeenCalledWith(data);
  });

  it("turns the queued date back into a date for the email alerts", async () => {
    await processNotification({
      name: "email.login-alert",
      data: { to: "a@example.com", date: "2026-10-26T10:30:00.000Z" },
    });
    const sent = mail.sendLoginAlertEmail.mock.calls[0][0];
    expect(sent.date).toBeInstanceOf(Date);
    expect(sent.date.toISOString()).toBe("2026-10-26T10:30:00.000Z");

    await processNotification({
      name: "email.security-alert",
      data: { to: "a@example.com", type: "X", date: "2026-10-26T10:30:00.000Z" },
    });
    expect(mail.sendSecurityAlertEmail.mock.calls[0][0].date).toBeInstanceOf(Date);
  });
});

describe("maintenance schedule", () => {
  it("registers the hourly signup cleanup and the daily data and notification cleanups", async () => {
    const maintenance = loadWithMocks("jobs/maintenance.job.js", {
      "core/queue/queues.js": queues,
      "core/db/prisma.js": { getPrisma: () => ({}) },
    });
    await maintenance.scheduleMaintenance();

    expect(queues.getQueue).toHaveBeenCalledWith("maintenance");
    expect(upsertJobScheduler).toHaveBeenCalledTimes(3);
    expect(upsertJobScheduler).toHaveBeenCalledWith(
      "cleanup-notifications",
      { every: 24 * 60 * 60 * 1000 },
      { name: "cleanup.notifications" },
    );
    expect(upsertJobScheduler).toHaveBeenCalledWith(
      "cleanup-unconfirmed-signups",
      { every: 60 * 60 * 1000 },
      { name: "cleanup.unconfirmed-signups" },
    );
    expect(upsertJobScheduler).toHaveBeenCalledWith(
      "cleanup-expired-data",
      { every: 24 * 60 * 60 * 1000 },
      { name: "cleanup.expired-data" },
    );
  });

  it("removes unconfirmed signups older than three days only", async () => {
    const deleteMany = vi.fn(async () => ({ count: 4 }));
    const maintenance = loadWithMocks("jobs/maintenance.job.js", {
      "core/queue/queues.js": queues,
      "core/db/prisma.js": { getPrisma: () => ({ user: { deleteMany } }) },
    });
    expect(await maintenance.cleanUnconfirmedSignups()).toBe(4);

    const { where } = deleteMany.mock.calls[0][0];
    expect(where.status).toBe("PENDING");
    const cutoff = Date.now() - where.updatedAt.lt.getTime();
    expect(cutoff).toBeGreaterThan(3 * 24 * 60 * 60 * 1000 - 5000);
    expect(cutoff).toBeLessThan(3 * 24 * 60 * 60 * 1000 + 5000);
  });
});
