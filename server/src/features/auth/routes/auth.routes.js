const { Router } = require("express");
const controller = require("../controllers/auth.controller");
const { validate } = require("../../../core/middlewares/validate.middleware");
const { otpLimiter, authLimiter } = require("../../../core/middlewares/rateLimit.middleware");
const {
  signupEmailBody,
  signupPhoneBody,
  verifySignupBody,
  resendSignupBody,
} = require("../validators/signup.validator");

const router = Router();

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

module.exports = router;
