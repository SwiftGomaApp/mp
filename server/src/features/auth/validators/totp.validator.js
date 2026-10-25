const { z, check } = require("zod");
const { stepUpCode } = require("./stepUp.validator");

const code = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Code invalide");

const backupCode = z.string().trim().min(8).max(20);

const exactlyOneFactor = {
  check: (b) => Boolean(b.code) !== Boolean(b.backupCode),
  params: {
    message: "Fournissez un code de l'application ou un code de secours",
    path: ["code"],
  },
};

const confirmBody = z.object({ code, stepUpCode });

const factorBody = z
  .object({ code: code.optional(), backupCode: backupCode.optional() })
  .refine(exactlyOneFactor.check, exactlyOneFactor.params);

const loginChallengeBody = z
  .object({
    challengeToken: z.string().trim().min(32).max(128),
    code: code.optional(),
    backupCode: backupCode.optional(),
  })
  .refine(exactlyOneFactor.check, exactlyOneFactor.params);

const enrollSetupBody = z.object({ challengeToken: loginChallengeBody.shape.challengeToken });
const enrollConfirmBody = z.object({
  challengeToken: loginChallengeBody.shape.challengeToken,
  code,
});

module.exports = {
  confirmBody,
  factorBody,
  loginChallengeBody,
  enrollSetupBody,
  enrollConfirmBody,
};
