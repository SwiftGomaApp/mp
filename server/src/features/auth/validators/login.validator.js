const { z } = require("zod");
const { drcPhone, email } = require("../../../core/validation/common");
const { verifySignupBody } = require("./signup.validator");

const loginOtpRequestBody = z
  .object({
    email: email.optional(),
    phone: drcPhone.optional(),
    channel: z.enum(["SMS", "EMAIL"]).optional(),
  })
  .refine((b) => Boolean(b.email) !== Boolean(b.phone), {
    message: "Fournissez soit un e-mail, soit un numéro de téléphone",
    path: ["email"],
  })
  .refine((b) => !(b.channel === "EMAIL" && b.email), {
    message: "Le choix du canal ne s'applique qu'aux numéros de téléphone",
    path: ["channel"],
  });
const loginOtpVerifyBody = verifySignupBody;

module.exports = { loginOtpRequestBody, loginOtpVerifyBody };
