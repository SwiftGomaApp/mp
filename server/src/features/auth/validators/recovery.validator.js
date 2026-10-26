const { z } = require("zod");
const { drcPhone, email } = require("../../../core/validation/common");

const code = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Code invalide");

const token = z.string().trim().min(32).max(128);
const kind = z.enum(["EMAIL", "PHONE"]);

const identifier = { email: email.optional(), phone: drcPhone.optional() };
const exactlyOneIdentifier = {
  check: (b) => Boolean(b.email) !== Boolean(b.phone),
  params: { message: "Fournissez soit un e-mail, soit un numéro de téléphone", path: ["email"] },
};

const recoveryRequestBody = z
  .object({ ...identifier, kind: kind.optional() })
  .refine(exactlyOneIdentifier.check, exactlyOneIdentifier.params);

const recoveryVerifyBody = z
  .object({ ...identifier, kind: kind.optional(), code })
  .refine(exactlyOneIdentifier.check, exactlyOneIdentifier.params);

const newContact = [
  z.object({ kind: z.literal("EMAIL"), value: email }),
  z.object({ kind: z.literal("PHONE"), value: drcPhone }),
];

const recoveryContactBody = z.discriminatedUnion("kind", [
  newContact[0].extend({ token }),
  newContact[1].extend({ token }),
]);

const completeFields = { token, code, backupCode: z.string().trim().min(8).max(20).optional() };
const recoveryCompleteBody = z.discriminatedUnion("kind", [
  newContact[0].extend(completeFields),
  newContact[1].extend(completeFields),
]);

module.exports = {
  recoveryRequestBody,
  recoveryVerifyBody,
  recoveryContactBody,
  recoveryCompleteBody,
};
