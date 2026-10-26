const { z } = require("zod");
const { email } = require("../../../core/validation/common");
const { newPassword } = require("./password.validator");

const code = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Code invalide");

const createStaffBody = z.object({
  name: z.string().trim().min(2).max(100),
  email,
  code,
});

const staffSetupBody = z.object({
  token: z.string().trim().min(32).max(128),
  newPassword,
});

const resendStaffSetupBody = z.object({ code });

const resetStaffTwoFactorBody = z.object({
  code,
  reason: z.string().trim().min(5, "Indiquez la raison").max(500),
});

module.exports = { createStaffBody, staffSetupBody, resendStaffSetupBody, resetStaffTwoFactorBody };
