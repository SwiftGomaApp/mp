const { z } = require("zod");
const { email, drcPhone } = require("../../../core/validation/common");
const { stepUpCode } = require("../../auth/validators/stepUp.validator");

const code = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Code invalide");

const primaryContactRequestBody = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("EMAIL"), value: email, stepUpCode }),
  z.object({ kind: z.literal("PHONE"), value: drcPhone, stepUpCode }),
]);

const primaryContactVerifyBody = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("EMAIL"), value: email, code }),
  z.object({ kind: z.literal("PHONE"), value: drcPhone, code }),
]);

module.exports = { primaryContactRequestBody, primaryContactVerifyBody };
