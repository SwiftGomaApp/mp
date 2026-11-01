const { Router } = require("express");
const { validate } = require("../../../core/middlewares/validate.middleware");
const { authenticate } = require("../../../core/middlewares/auth.middleware");
const { fileUpload } = require("../../../core/middlewares/upload.middleware");
const { idParams } = require("../../../core/validation/common");
const controller = require("../controllers/user.controller");
const { usersConfig } = require("../config/users.config");
const { updateProfileBody } = require("../validators/profile.validator");
const { createAddressBody, updateAddressBody } = require("../validators/address.validator");
const {
  createLimiter,
  stepUpLimiter,
  authLimiter,
} = require("../../../core/middlewares/rateLimit.middleware");
const {
  primaryContactRequestBody,
  primaryContactVerifyBody,
} = require("../validators/contact.validator");
const { updatePreferencesBody } = require("../validators/preferences.validator");
const { requestDeletionBody } = require("../validators/deletion.validator");

const writeLimiter = createLimiter({
  name: "users-write",
  windowMs: 60 * 1000,
  limit: 30,
  message: "Trop de requêtes, veuillez réessayer dans un instant",
  keyGenerator: (req) => req.auth.userId,
});

const uploadLimiter = createLimiter({
  name: "users-upload",
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: "Trop de téléchargements, veuillez réessayer plus tard",
  keyGenerator: (req) => req.auth.userId,
});

const router = Router();

router.use(authenticate);

// ===================================== PROFILE =====================================
router.get("/me", controller.getProfile);
router.patch("/me", validate({ body: updateProfileBody }), writeLimiter, controller.updateProfile);

// ===================================== AVATAR =====================================
router.put(
  "/me/avatar",
  uploadLimiter,
  ...fileUpload({
    field: "avatar",
    maxBytes: usersConfig.avatar.maxBytes,
    mimeTypes: usersConfig.avatar.allowedMimeTypes,
  }),
  controller.uploadAvatar,
);
router.delete("/me/avatar", writeLimiter, controller.removeAvatar);

// ===================================== ADDRESSES =====================================
router.get("/me/addresses", controller.listAddresses);
router.post(
  "/me/addresses",
  validate({ body: createAddressBody }),
  writeLimiter,
  controller.createAddress,
);
router.patch(
  "/me/addresses/:id",
  validate({ params: idParams, body: updateAddressBody }),
  writeLimiter,
  controller.updateAddress,
);
router.delete(
  "/me/addresses/:id",
  validate({ params: idParams }),
  writeLimiter,
  controller.removeAddress,
);

// ===================================== PRIMARY CONTACT =====================================
router.post(
  "/me/contact/otp",
  validate({ body: primaryContactRequestBody }),
  stepUpLimiter,
  controller.requestContactChange,
);
router.post(
  "/me/contact/verify",
  validate({ body: primaryContactVerifyBody }),
  authLimiter,
  controller.verifyContactChange,
);

// ===================================== PREFERENCES =====================================
router.get("/me/preferences", controller.getPreferences);
router.patch(
  "/me/preferences",
  validate({ body: updatePreferencesBody }),
  writeLimiter,
  controller.updatePreferences,
);

// ===================================== ACCOUNT DELETION =====================================
router.get("/me/deletion", controller.getDeletionOverview);
router.post(
  "/me/deletion",
  validate({ body: requestDeletionBody }),
  authLimiter,
  controller.requestAccountDeletion,
);

module.exports = router;
