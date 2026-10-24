const { z } = require("zod");
const { email, drcPhone } = require("../../../core/validation/common");

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
  contactFields.EMAIL,
  contactFields.PHONE,
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

module.exports = {
  secondaryContactRequestBody,
  secondaryContactVerifyBody,
};
