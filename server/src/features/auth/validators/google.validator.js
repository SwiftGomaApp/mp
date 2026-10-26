const { z } = require("zod");
const { authConfig } = require("../config/auth.config");
const { device } = require("./signup.validator");
const { stepUpCode } = require("./stepUp.validator");

const idToken = z.string().trim().min(1).max(8192);

const nonce = z.string().trim().min(32).max(256);

const googleLoginBody = z.object({
  idToken,
  nonce,
  device,
});

const googleSignupBody = z.object({
  idToken,
  nonce,
  role: z.enum(authConfig.selfSignupRoles),
  acceptTerms: z.literal(true, {
    error: "Vous devez accepter les conditions d'utilisation et la politique de confidentialité",
  }),
  confirmAge: z.literal(true, {
    error: `Vous devez avoir au moins ${authConfig.minAge} ans`,
  }),
  device,
});

const googleLinkBody = z.object({ idToken, stepUpCode });

module.exports = {
  googleLoginBody,
  googleSignupBody,
  googleLinkBody,
};
