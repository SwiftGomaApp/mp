const express = require("express");
const { validate } = require("../../../core/middlewares/validate.middleware");
const { authenticate, requireRole } = require("../../../core/middlewares/auth.middleware");
const { createLimiter } = require("../../../core/middlewares/rateLimit.middleware");
const { idParams, pagination } = require("../../../core/validation/common");
const admin = require("../controllers/admin.controller");
const publicController = require("../controllers/public.controller");
const v = require("../validators/marketing.validator");

const writeLimiter = createLimiter({
  name: "marketing-write",
  windowMs: 60 * 1000,
  limit: 60,
  message: "Trop de requêtes, veuillez réessayer dans un instant",
  keyGenerator: (req) => req.auth.userId,
});

const sendLimiter = createLimiter({
  name: "marketing-send",
  windowMs: 60 * 60 * 1000,
  limit: 20,
  message: "Trop d'envois, veuillez réessayer plus tard",
  keyGenerator: (req) => req.auth.userId,
});

const router = express.Router();

// ===================================== PUBLIC (links inside emails) =====================================
const pub = express.Router();
const token = validate({ params: v.tokenParams });

pub.get("/o/:token", token, publicController.openPixel);
pub.get("/c/:token", token, publicController.click);
pub.get("/u/:token", token, publicController.unsubscribePage);
pub.post(
  "/u/:token",
  express.urlencoded({ extended: false, limit: "2kb" }),
  token,
  publicController.unsubscribe,
);
router.use("/p", pub);

// ===================================== ADMIN =====================================
router.use(authenticate, requireRole("ADMIN"));

router.get("/segments", validate({ query: pagination }), admin.listSegments);
router.post("/segments", validate({ body: v.segmentBody }), writeLimiter, admin.createSegment);
router.post("/segments/preview", validate({ body: v.previewBody }), writeLimiter, admin.previewSegment);
router.get("/segments/:id", validate({ params: idParams }), admin.getSegment);
router.patch(
  "/segments/:id",
  validate({ params: idParams, body: v.segmentPatch }),
  writeLimiter,
  admin.updateSegment,
);
router.delete("/segments/:id", validate({ params: idParams }), writeLimiter, admin.deleteSegment);

router.get("/templates", validate({ query: pagination }), admin.listTemplates);
router.post("/templates", validate({ body: v.templateCreateBody }), writeLimiter, admin.createTemplate);
router.get("/templates/:key", validate({ params: v.templateParams }), admin.getTemplate);
router.patch(
  "/templates/:key",
  validate({ params: v.templateParams, body: v.templatePatch }),
  writeLimiter,
  admin.updateTemplate,
);

router.get("/campaigns", validate({ query: v.campaignListQuery }), admin.listCampaigns);
router.post("/campaigns", validate({ body: v.campaignCreateBody }), writeLimiter, admin.createCampaign);
router.get("/campaigns/:id", validate({ params: idParams }), admin.getCampaign);
router.patch(
  "/campaigns/:id",
  validate({ params: idParams, body: v.campaignPatch }),
  writeLimiter,
  admin.updateCampaign,
);
router.delete("/campaigns/:id", validate({ params: idParams }), writeLimiter, admin.deleteCampaign);
router.post(
  "/campaigns/:id/schedule",
  validate({ params: idParams, body: v.scheduleBody }),
  sendLimiter,
  admin.scheduleCampaign,
);
router.post("/campaigns/:id/send", validate({ params: idParams }), sendLimiter, admin.sendCampaign);
router.post("/campaigns/:id/cancel", validate({ params: idParams }), writeLimiter, admin.cancelCampaign);
router.post("/campaigns/:id/test", validate({ params: idParams }), sendLimiter, admin.testCampaign);
router.get("/campaigns/:id/stats", validate({ params: idParams }), admin.campaignStats);

router.get(
  "/campaigns/:id/recipients",
  validate({ params: idParams, query: v.recipientsQuery }),
  admin.listRecipients,
);

router.get("/suppressions", validate({ query: v.suppressionListQuery }), admin.listSuppressions);
router.post("/suppressions", validate({ body: v.suppressionBody }), writeLimiter, admin.addSuppression);
router.delete("/suppressions/:id", validate({ params: idParams }), writeLimiter, admin.removeSuppression);

router.get("/analytics", validate({ query: v.overviewQuery }), admin.overview);

module.exports = router;
