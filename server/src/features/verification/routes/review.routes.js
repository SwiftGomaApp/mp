const { Router } = require("express");
const { validate } = require("../../../core/middlewares/validate.middleware");
const { authenticate, requireRole } = require("../../../core/middlewares/auth.middleware");
const { createLimiter } = require("../../../core/middlewares/rateLimit.middleware");
const controller = require("../controllers/review.controller");
const {
  caseParams,
  caseDocumentParams,
  listQuery,
  callBody,
  opinionBody,
  decisionBody,
} = require("../validators/review.validator");

const writeLimiter = createLimiter({
  name: "verification-review-write",
  windowMs: 60 * 1000,
  limit: 60,
  message: "Trop de requêtes, veuillez réessayer dans un instant",
  keyGenerator: (req) => req.auth.userId,
});

// Every opening of a document is logged, so the number of views is capped.
const documentLimiter = createLimiter({
  name: "verification-review-document",
  windowMs: 60 * 60 * 1000,
  limit: 200,
  message: "Trop de documents consultés, veuillez réessayer plus tard",
  keyGenerator: (req) => req.auth.userId,
});

const router = Router();

router.use(authenticate);

const staff = requireRole("SUPPORT", "ADMIN");
const adminOnly = requireRole("ADMIN");

router.get("/cases", staff, validate({ query: listQuery }), controller.listCases);
router.get("/cases/:id", staff, validate({ params: caseParams }), controller.getCase);

router.post("/cases/:id/take", staff, validate({ params: caseParams }), writeLimiter, controller.takeCase);
router.post(
  "/cases/:id/calls",
  staff,
  validate({ params: caseParams, body: callBody }),
  writeLimiter,
  controller.logCall,
);
router.put(
  "/cases/:id/opinion",
  staff,
  validate({ params: caseParams, body: opinionBody }),
  writeLimiter,
  controller.giveOpinion,
);
router.get(
  "/cases/:id/documents/:type/link",
  staff,
  validate({ params: caseDocumentParams }),
  documentLimiter,
  controller.viewDocument,
);

router.post(
  "/cases/:id/approve",
  adminOnly,
  validate({ params: caseParams, body: decisionBody }),
  writeLimiter,
  controller.approveCase,
);
router.post(
  "/cases/:id/reject",
  adminOnly,
  validate({ params: caseParams, body: decisionBody }),
  writeLimiter,
  controller.rejectCase,
);

module.exports = router;
