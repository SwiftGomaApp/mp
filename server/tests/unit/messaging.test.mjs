import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { loadWithMocks } from "../helpers/mockModules.mjs";

const require = createRequire(import.meta.url);
const { securityAlertInfo } = require("../../src/core/messaging/securityAlert");

const ALERT_TYPES = [
  "LOGIN_METHOD_ADDED",
  "LOGIN_METHOD_REMOVED",
  "PASSKEY_REMOVED",
  "SECONDARY_CONTACT_ADDED",
  "SECONDARY_CONTACT_CHANGED",
  "SECONDARY_CONTACT_REMOVED",
  "RECOVERY_REQUESTED",
  "RECOVERY_COMPLETED",
  "TWO_FACTOR_ENABLED",
  "TWO_FACTOR_DISABLED",
  "BACKUP_CODES_REGENERATED",
  "BACKUP_CODE_USED",
  "PASSWORD_SET",
  "PASSWORD_CHANGED",
  "PASSWORD_RESET",
  "PASSWORD_REMOVED",
];

describe("security alert texts", () => {
  it.each(ALERT_TYPES)("%s has a subject, a title and an SMS text", (type) => {
    const info = securityAlertInfo(type);
    expect(info.subject.length).toBeGreaterThan(10);
    expect(info.title.length).toBeGreaterThan(10);
    expect(info.sms.length).toBeGreaterThan(10);
    expect(info.sms).toBe(info.sms.toLowerCase().charAt(0) + info.sms.slice(1));
  });

  it("falls back to a generic message for unknown types", () => {
    expect(securityAlertInfo("SOMETHING_NEW").title).toMatch(/changement de sécurité/);
    expect(securityAlertInfo(undefined).subject).toMatch(/Changement de sécurité/);
  });
});

describe("SMS texts", () => {
  const sent = [];
  const sms = loadWithMocks("core/messaging/sms.service.js", {
    "core/messaging/sms.js": { sendSms: async (message) => sent.push(message) },
  });

  beforeEach(() => {
    sent.length = 0;
  });

  it("greets each role with the right next step", async () => {
    await sms.sendWelcomeSms({ to: "+243891234567", name: "Alice", role: "SELLER" });
    await sms.sendWelcomeSms({ to: "+243891234567", name: "Alice", role: "RIDER" });
    await sms.sendWelcomeSms({ to: "+243891234567", name: "Alice", role: "BUYER" });
    await sms.sendWelcomeSms({ to: "+243891234567", role: "OTHER" });

    expect(sent[0].message).toMatch(/activer votre boutique/);
    expect(sent[1].message).toMatch(/pouvoir livrer/);
    expect(sent[2].message).toMatch(/commandez/);
    expect(sent[3].message).toMatch(/^SwiftGoma : bienvenue !/);
    expect(sent.every((s) => s.to === "+243891234567")).toBe(true);
  });

  it("mentions the device and place in the new login alert", async () => {
    await sms.sendLoginAlertSms({
      to: "+243891234567",
      deviceName: "Tecno Spark",
      location: "Goma",
    });
    expect(sent[0].message).toContain("Tecno Spark");
    expect(sent[0].message).toContain("Goma");
  });

  it.each(ALERT_TYPES)("keeps the %s alert in a single SMS segment", async (type) => {
    await sms.sendSecurityAlertSms({ to: "+243891234567", type });
    expect(sent[0].message.length).toBeLessThanOrEqual(160);
    expect(sent[0].message).toMatch(/^SwiftGoma : /);
  });

  it("never puts the account password or links in a message", async () => {
    await sms.sendOtpSms({ to: "+243891234567", code: "123456", expiresMinutes: 10 });
    expect(sent[0].message).toContain("SWG-123456");
    expect(sent[0].message).not.toMatch(/https?:/);
  });
});

describe("SMS provider", () => {
  let settings;
  let response;
  const send = vi.fn();

  const smsModule = () =>
    loadWithMocks("core/messaging/sms.js", {
      "config/env.config.js": { getConfig: () => ({ sms: settings }) },
      "pkg:africastalking": () => ({ SMS: { send } }),
    });

  beforeEach(() => {
    settings = { username: "u", apiKey: "k", senderId: "SWG", dryRun: false, timeoutMs: 200 };
    response = {
      SMSMessageData: {
        Recipients: [{ statusCode: 101, messageId: "m1", cost: "USD 0.01", status: "Success" }],
      },
    };
    send.mockReset();
    send.mockImplementation(async () => response);
  });

  it("sends through the provider with the sender id", async () => {
    const { sendSms } = smsModule();
    const result = await sendSms({ to: "+243891234567", message: "bonjour" });

    expect(send).toHaveBeenCalledWith({ to: ["+243891234567"], message: "bonjour", from: "SWG" });
    expect(result).toMatchObject({ messageId: "m1", status: "Success" });
  });

  it("does not call the provider in dry-run mode", async () => {
    settings.dryRun = true;
    const { sendSms } = smsModule();
    const result = await sendSms({ to: "+243891234567", message: "bonjour" });
    expect(send).not.toHaveBeenCalled();
    expect(result.status).toBe("DryRun");
  });

  it("refuses numbers outside the DRC before calling the provider", async () => {
    const { sendSms } = smsModule();
    await expect(sendSms({ to: "+33612345678", message: "x" })).rejects.toMatchObject({
      status: 400,
      code: "INVALID_PHONE",
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("reports an invalid number when the provider says so", async () => {
    response = {
      SMSMessageData: { Recipients: [{ statusCode: 403, status: "InvalidPhoneNumber" }] },
    };
    const { sendSms } = smsModule();
    await expect(sendSms({ to: "+243891234567", message: "x" })).rejects.toMatchObject({
      code: "INVALID_PHONE",
    });
  });

  it("reports the service as unavailable for other rejections and failures", async () => {
    const { sendSms } = smsModule();

    response = { SMSMessageData: { Recipients: [{ statusCode: 502, status: "Failed" }] } };
    await expect(sendSms({ to: "+243891234567", message: "x" })).rejects.toMatchObject({
      status: 503,
      code: "SMS_UNAVAILABLE",
    });

    send.mockRejectedValueOnce(new Error("network down"));
    await expect(sendSms({ to: "+243891234567", message: "x" })).rejects.toMatchObject({
      code: "SMS_UNAVAILABLE",
    });

    response = { SMSMessageData: { Recipients: [] } };
    await expect(sendSms({ to: "+243891234567", message: "x" })).rejects.toMatchObject({
      code: "SMS_UNAVAILABLE",
    });
  });

  it("gives up when the provider is too slow", async () => {
    send.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 1000)));
    const { sendSms } = smsModule();
    await expect(sendSms({ to: "+243891234567", message: "x" })).rejects.toMatchObject({
      code: "SMS_UNAVAILABLE",
    });
  });

  it("hides most of the phone number in logs", () => {
    const { maskPhone } = smsModule();
    expect(maskPhone("+243891234567")).toBe("+24389***67");
    expect(maskPhone("")).toBe("***");
  });
});
