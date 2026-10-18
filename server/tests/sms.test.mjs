import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { otpMessage } = require("../src/core/messaging/sms.service");

describe("OTP SMS message", () => {
  it("contains the code and the expiry", () => {
    const message = otpMessage({ code: "084471", expiresMinutes: 5 });
    expect(message).toContain("SWG-084471");
    expect(message).toContain("5");
  });

  it("fits in a single SMS segment", () => {
    const message = otpMessage({ code: "084471", expiresMinutes: 10 });
    expect(message.length).toBeLessThanOrEqual(160);
  });
});
