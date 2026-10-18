import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { UnrecoverableError } = require("bullmq");
const { AppError } = require("../src/core/errors/AppError");
const { createNotificationProcessor } = require("../src/jobs/notifications.job");

function processorFailingWith(error) {
  return createNotificationProcessor({
    "sms.otp": async () => {
      throw error;
    },
  });
}

const job = { name: "sms.otp", data: {} };

describe("notification processor", () => {
  it("resolves when the handler succeeds", async () => {
    let received = null;
    const process = createNotificationProcessor({
      "sms.otp": async (data) => {
        received = data;
      },
    });
    await process({ name: "sms.otp", data: { to: "+243893039790" } });
    expect(received).toEqual({ to: "+243893039790" });
  });

  it("does not retry permanent 4xx failures", async () => {
    const process = processorFailingWith(
      AppError.badRequest("Numéro invalide", null, "INVALID_PHONE"),
    );
    await expect(process(job)).rejects.toBeInstanceOf(UnrecoverableError);
    await expect(process(job)).rejects.toThrow("INVALID_PHONE");
  });

  it("keeps 429 retryable", async () => {
    const error = AppError.tooManyRequests();
    await expect(processorFailingWith(error)(job)).rejects.toBe(error);
  });

  it("keeps provider outages (5xx) retryable", async () => {
    const error = new AppError(503, "SMS_UNAVAILABLE", "Indisponible");
    const rejection = processorFailingWith(error)(job);
    await expect(rejection).rejects.toBe(error);
    await expect(rejection).rejects.not.toBeInstanceOf(UnrecoverableError);
  });

  it("keeps unexpected errors retryable", async () => {
    const error = new Error("socket hang up");
    await expect(processorFailingWith(error)(job)).rejects.toBe(error);
  });

  it("does not retry unknown job names", async () => {
    const process = createNotificationProcessor({});
    await expect(process({ name: "nope", data: {} })).rejects.toBeInstanceOf(UnrecoverableError);
  });
});
