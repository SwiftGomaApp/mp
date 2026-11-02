const { Router } = require("express");
const { validate } = require("../../../core/middlewares/validate.middleware");
const { authenticate, requireRole } = require("../../../core/middlewares/auth.middleware");
const { fileUpload } = require("../../../core/middlewares/upload.middleware");
const { createLimiter } = require("../../../core/middlewares/rateLimit.middleware");
const controller = require("../controllers/verification.controller");
const { verificationConfig } = require("../config/verification.config");
const {
  documentParams,
  uploadDocumentBody,
  detailsBody,
} = require("../validators/verification.validator");

const writeLimiter = createLimiter({
  name: "verification-write",
  windowMs: 60 * 1000,
  limit: 30,
  message: "Trop de requêtes, veuillez réessayer dans un instant",
  keyGenerator: (req) => req.auth.userId,
});

// A rider sends up to 9 files, and may replace some of them.
const uploadLimiter = createLimiter({
  name: "verification-upload",
  windowMs: 60 * 60 * 1000,
  limit: 40,
  message: "Trop de téléchargements, veuillez réessayer plus tard",
  keyGenerator: (req) => req.auth.userId,
});

const submitLimiter = createLimiter({
  name: "verification-submit",
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: "Trop de tentatives d'envoi, veuillez réessayer plus tard",
  keyGenerator: (req) => req.auth.userId,
});

const router = Router();

router.use(authenticate, requireRole("SELLER", "RIDER"));

router.get("/me", controller.getMyCase);
router.post("/start", writeLimiter, controller.startCase);
router.patch("/details", validate({ body: detailsBody }), writeLimiter, controller.saveDetails);

router.put(
  "/documents/:type",
  validate({ params: documentParams }),
  uploadLimiter,
  ...fileUpload({
    field: "file",
    maxBytes: verificationConfig.file.maxBytes,
    mimeTypes: verificationConfig.file.documentMimeTypes,
  }),
  validate({ body: uploadDocumentBody }),
  controller.uploadDocument,
);
router.delete(
  "/documents/:type",
  validate({ params: documentParams }),
  writeLimiter,
  controller.removeDocument,
);

router.post("/submit", submitLimiter, controller.submitCase);

module.exports = router;
