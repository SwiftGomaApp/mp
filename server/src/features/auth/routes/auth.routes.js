const { Router } = require("express");
const controller = require("../controllers/auth.controller");
const { validate } = require("../../../core/middlewares/validate.middleware");
const { authenticate } = require("../../../core/middlewares/auth.middleware");
const {
  otpLimiter,
  authLimiter,
  stepUpLimiter,
  refreshLimiter,
} = require("../../../core/middlewares/rateLimit.middleware");
const {
  signupEmailBody,
  signupPhoneBody,
  verifySignupBody,
  resendSignupBody,
} = require("../validators/signup.validator");
const { loginOtpRequestBody, loginOtpVerifyBody } = require("../validators/login.validator");
const { refreshBody } = require("../validators/session.validator");
const {
  confirmBody,
  factorBody,
  loginChallengeBody,
  enrollSetupBody,
  enrollConfirmBody,
} = require("../validators/totp.validator");
const { idParams } = require("../../../core/validation/common");
const {
  registerPasskeyBody,
  renamePasskeyBody,
  loginPasskeyBody,
} = require("../validators/passkey.validator");
const passwordController = require("../controllers/password.controller");
const {
  passwordOtpRequestBody,
  createPasswordBody,
  updatePasswordBody,
  removePasswordBody,
  forgotPasswordBody,
  resetPasswordBody,
  loginPasswordBody,
} = require("../validators/password.validator");

const googleController = require("../controllers/google.controller");

const {
  googleLoginBody,
  googleSignupBody,
  googleLinkBody,
} = require("../validators/google.validator");

const router = Router();

// ===================================== SIGNUP =====================================
router.post(
  "/signup/email",
  validate({ body: signupEmailBody }),
  ...otpLimiter,
  controller.signupEmail,
);
router.post(
  "/signup/phone",
  validate({ body: signupPhoneBody }),
  ...otpLimiter,
  controller.signupPhone,
);
router.post("/signup/verify", validate({ body: verifySignupBody }), authLimiter, controller.verify);
router.post(
  "/signup/resend",
  validate({ body: resendSignupBody }),
  ...otpLimiter,
  controller.resend,
);

// ===================================== LOGIN =====================================
router.post(
  "/login/otp/request",
  validate({ body: loginOtpRequestBody }),
  ...otpLimiter,
  controller.requestOtp,
);
router.post(
  "/login/otp/verify",
  validate({ body: loginOtpVerifyBody }),
  authLimiter,
  controller.verifyOtp,
);

router.post(
  "/2fa/verify",
  validate({ body: loginChallengeBody }),
  authLimiter,
  controller.verifyLogin,
);

router.post(
  "/2fa/enroll/setup",
  validate({ body: enrollSetupBody }),
  authLimiter,
  controller.enrollSetup,
);
router.post(
  "/2fa/enroll/confirm",
  validate({ body: enrollConfirmBody }),
  authLimiter,
  controller.enrollConfirm,
);

router.post(
  "/login/password",
  validate({ body: loginPasswordBody }),
  authLimiter,
  passwordController.login,
);

// ===================================== SESSIONS =====================================
router.post("/refresh", validate({ body: refreshBody }), refreshLimiter, controller.refresh);
router.get("/me", authenticate, controller.me);

// ===================================== Devices & logout =====================================
router.post("/logout", authenticate, controller.logout);
router.post("/logout-all", authenticate, controller.logoutAll);
router.get("/sessions", authenticate, controller.sessions);
router.delete(
  "/sessions/:id",
  authenticate,
  validate({ params: idParams }),
  controller.disconnectDevice,
);

// ===================================== 2FA =====================================
router.get("/2fa", authenticate, controller.status);
router.post("/2fa/setup", authenticate, authLimiter, controller.setup);
router.post(
  "/2fa/confirm",
  authenticate,
  validate({ body: confirmBody }),
  authLimiter,
  controller.confirm,
);
router.post(
  "/2fa/disable",
  authenticate,
  validate({ body: factorBody }),
  authLimiter,
  controller.disable,
);
router.post(
  "/2fa/backup-codes",
  authenticate,
  validate({ body: factorBody }),
  authLimiter,
  controller.regenerateBackupCodes,
);

// ===================================== Passkeys =====================================
router.post("/login/passkey/options", authLimiter, controller.passkeyLoginOptions);
router.post(
  "/login/passkey/verify",
  validate({ body: loginPasskeyBody }),
  authLimiter,
  controller.passkeyLoginVerify,
);

router.get("/passkeys", authenticate, controller.passkeyList);
router.post("/passkeys/options", authenticate, authLimiter, controller.passkeyRegisterOptions);
router.post(
  "/passkeys/verify",
  authenticate,
  validate({ body: registerPasskeyBody }),
  authLimiter,
  controller.passkeyRegisterVerify,
);
router.patch(
  "/passkeys/:id",
  authenticate,
  validate({ params: idParams, body: renamePasskeyBody }),
  controller.passkeyRename,
);
router.delete(
  "/passkeys/:id",
  authenticate,
  validate({ params: idParams }),
  controller.passkeyRemove,
);

// ===================================== FORGOT / RESET (public) =====================================
router.post(
  "/password/forgot",
  validate({ body: forgotPasswordBody }),
  ...otpLimiter,
  passwordController.forgot,
);
router.post(
  "/password/reset",
  validate({ body: resetPasswordBody }),
  authLimiter,
  passwordController.reset,
);

// ===================================== SIGNED IN (each change needs a fresh code) =====================================
router.post(
  "/password/otp/request",
  authenticate,
  validate({ body: passwordOtpRequestBody }),
  stepUpLimiter,
  passwordController.requestStepUp,
);
router.post(
  "/password",
  authenticate,
  validate({ body: createPasswordBody }),
  authLimiter,
  passwordController.create,
);
router.put(
  "/password",
  authenticate,
  validate({ body: updatePasswordBody }),
  authLimiter,
  passwordController.update,
);
router.post(
  "/password/remove",
  authenticate,
  validate({ body: removePasswordBody }),
  authLimiter,
  passwordController.remove,
);

// ===================================== GOOGLE OAUTH =====================================

router.post(
  "/login/google",
  validate({ body: googleLoginBody }),
  authLimiter,
  googleController.login,
);

router.post(
  "/signup/google",
  validate({ body: googleSignupBody }),
  authLimiter,
  googleController.signup,
);

router.post(
  "/google/link",
  authenticate,
  validate({ body: googleLinkBody }),
  authLimiter,
  googleController.link,
);

module.exports = router;
