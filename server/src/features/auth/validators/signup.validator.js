const { z } = require("zod");
const { drcPhone, email } = require("../../../core/validation/common");
const { authConfig } = require("../config/auth.config");

const name = z.string().trim().min(2).max(100);
const role = z.enum(authConfig.selfSignupRoles);

const acceptTerms = z.literal(true, {
  error: "Vous devez accepter les conditions d'utilisation et la politique de confidentialité",
});
const confirmAge = z.literal(true, {
  error: `Vous devez avoir au moins ${authConfig.minAge} ans`,
});

const device = z.object({
  deviceId: z.string().trim().min(8).max(128),
  deviceName: z.string().trim().max(100).optional(),
  platform: z.enum(["ANDROID", "IOS", "WEB"]),
});

const signupEmailBody = z.object({ name, email, role, acceptTerms, confirmAge });
const signupPhoneBody = z.object({ name, phone: drcPhone, role, acceptTerms, confirmAge });

const exactlyOneTarget = {
  check: (b) => Boolean(b.email) !== Boolean(b.phone),
  params: { message: "Fournissez soit un e-mail, soit un numéro de téléphone", path: ["email"] },
};

const targetFields = { email: email.optional(), phone: drcPhone.optional() };

const verifySignupBody = z
  .object({
    ...targetFields,
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Code invalide"),
    device,
  })
  .refine(exactlyOneTarget.check, exactlyOneTarget.params);

const resendSignupBody = z
  .object(targetFields)
  .refine(exactlyOneTarget.check, exactlyOneTarget.params);

module.exports = { signupEmailBody, signupPhoneBody, verifySignupBody, resendSignupBody };
