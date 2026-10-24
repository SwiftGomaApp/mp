const { z } = require("zod");
const { authConfig } = require("../config/auth.config");
const { device } = require("./signup.validator");

const idToken = z.string().trim().min(1).max(16384);

const nonce = z.string().trim().min(32).max(256);

const appleLoginBody = z.object({
  idToken,
  nonce,
  device,
});

const appleSignupBody = z.object({
  idToken,
  nonce,
  role: z.enum(authConfig.selfSignupRoles),
  acceptTerms: z.literal(true, {
    error: "Vous devez accepter les conditions d'utilisation et la politique de confidentialité",
  }),
  confirmAge: z.literal(true, {
    error: `Vous devez avoir au moins ${authConfig.minAge} ans`,
  }),
  name: z.string().trim().min(2).max(100).optional(),
  device,
});

const appleLinkBody = z.object({
  idToken,
  nonce,
});

module.exports = {
  appleLoginBody,
  appleSignupBody,
  appleLinkBody,
};
