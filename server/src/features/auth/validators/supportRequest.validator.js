const { z } = require("zod");
const { drcPhone, email } = require("../../../core/validation/common");

const supportRequestBody = z
  .object({
    email: email.optional(),
    phone: drcPhone.optional(),
    message: z.string().trim().min(10, "Expliquez votre situation").max(1000),
  })
  .refine((b) => Boolean(b.email) !== Boolean(b.phone), {
    message: "Fournissez soit un e-mail, soit un numéro de téléphone",
    path: ["email"],
  });

module.exports = { supportRequestBody };
