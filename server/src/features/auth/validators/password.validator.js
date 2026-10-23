const { z } = require("zod");
const { email } = require("../../../core/validation/common");
const { device } = require("./signup.validator");
const { authConfig } = require("../config/auth.config");

const { minLength, maxLength } = authConfig.password;

const code = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Code invalide");

const newPassword = z
  .string()
  .min(minLength, `Le mot de passe doit contenir au moins ${minLength} caractères`)
  .max(maxLength, `Le mot de passe ne doit pas dépasser ${maxLength} caractères`)
  .regex(/[A-Za-z]/, "Le mot de passe doit contenir au moins une lettre")
  .regex(/\d/, "Le mot de passe doit contenir au moins un chiffre");

const existingPassword = z.string().min(1, "Mot de passe requis").max(maxLength);

const passwordOtpRequestBody = z.object({ channel: z.enum(["EMAIL", "PHONE"]).optional() });
const createPasswordBody = z.object({ password: newPassword, code });
const updatePasswordBody = z.object({
  currentPassword: existingPassword,
  newPassword,
  code,
});
const removePasswordBody = z.object({ code });
const forgotPasswordBody = z.object({ email });
const resetPasswordBody = z.object({ email, code, newPassword });
const loginPasswordBody = z.object({ email, password: existingPassword, device });

module.exports = {
  passwordOtpRequestBody,
  createPasswordBody,
  updatePasswordBody,
  removePasswordBody,
  forgotPasswordBody,
  resetPasswordBody,
  loginPasswordBody,
};
