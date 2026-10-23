const { Router } = require("express");
const controller = require("../controllers/auth.controller");
const { validate } = require("../../../core/middlewares/validate.middleware");
const { authenticate } = require("../../../core/middlewares/auth.middleware");
const { otpLimiter, authLimiter } = require("../../../core/middlewares/rateLimit.middleware");
const {
  signupEmailBody,
  signupPhoneBody,
  verifySignupBody,
  resendSignupBody,
} = require("../validators/signup.validator");
const { loginOtpRequestBody, loginOtpVerifyBody } = require("../validators/login.validator");
const { refreshBody } = require("../validators/session.validator");
const { confirmBody, factorBody, loginChallengeBody } = require("../validators/totp.validator");
const { idParams } = require("../../../core/validation/common");
const {
  registerPasskeyBody,
  renamePasskeyBody,
  loginPasskeyBody,
} = require("../validators/passkey.validator");

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

// ===================================== SESSIONS =====================================
router.post("/refresh", validate({ body: refreshBody }), authLimiter, controller.refresh);
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

module.exports = router;
