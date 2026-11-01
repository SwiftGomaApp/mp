const { Router } = require("express");
const { validate } = require("../../../core/middlewares/validate.middleware");
const { authenticate } = require("../../../core/middlewares/auth.middleware");
const { createLimiter } = require("../../../core/middlewares/rateLimit.middleware");
const profile = require("../controllers/profile.controller");
const { updateProfileBody } = require("../validators/profile.validator");
const { fileUpload } = require("../../../core/middlewares/upload.middleware");
const avatar = require("../controllers/avatar.controller");
const { usersConfig } = require("../config/users.config");

const uploadLimiter = createLimiter({
  name: "users-upload",
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: "Trop de téléchargements, veuillez réessayer plus tard",
  keyGenerator: (req) => req.auth.userId,
});

const router = Router();

router.use(authenticate);

router.get("/me", profile.get);
router.patch("/me", validate({ body: updateProfileBody }), writeLimiter, profile.update);
router.put(
  "/me/avatar",
  uploadLimiter,
  ...fileUpload({
    field: "avatar",
    maxBytes: usersConfig.avatar.maxBytes,
    mimeTypes: usersConfig.avatar.allowedMimeTypes,
  }),
  avatar.upload,
);
router.delete("/me/avatar", writeLimiter, avatar.remove);

module.exports = router;
