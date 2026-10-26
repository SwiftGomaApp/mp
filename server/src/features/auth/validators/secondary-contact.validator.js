const { z } = require("zod");
const { email, drcPhone } = require("../../../core/validation/common");
const { stepUpCode } = require("./stepUp.validator");

const contactFields = {
  EMAIL: z.object({
    kind: z.literal("EMAIL"),
    value: email,
  }),
  PHONE: z.object({
    kind: z.literal("PHONE"),
    value: drcPhone,
  }),
};

const secondaryContactRequestBody = z.discriminatedUnion("kind", [
  contactFields.EMAIL.extend({ stepUpCode }),
  contactFields.PHONE.extend({ stepUpCode }),
]);

const secondaryContactVerifyBody = z.discriminatedUnion("kind", [
  contactFields.EMAIL.extend({
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Code invalide"),
  }),
  contactFields.PHONE.extend({
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Code invalide"),
  }),
]);

const secondaryContactRemoveBody = z.object({
  kind: z.enum(["EMAIL", "PHONE"]),
  stepUpCode,
});

module.exports = {
  secondaryContactRequestBody,
  secondaryContactVerifyBody,
  secondaryContactRemoveBody,
};
