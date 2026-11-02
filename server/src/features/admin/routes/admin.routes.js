const { Router } = require("express");
const controller = require("../controllers/admin.controller");
const { validate } = require("../../../core/middlewares/validate.middleware");
const { authenticate, requireRole } = require("../../../core/middlewares/auth.middleware");
const { createLimiter } = require("../../../core/middlewares/rateLimit.middleware");
const { idParams } = require("../../../core/validation/common");
const {
  reasonBody,
  stepUpReasonBody,
  listUsersQuery,
  activityQuery,
  auditQuery,
  changeRoleBody,
  moderateProfileBody,
  updateContactBody,
} = require("../validators/admin.validator");

// Slows down a stolen admin token on the actions that cannot be undone.
const destructiveLimiter = createLimiter({
  name: "admin-destructive",
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: "Trop d'actions sensibles, veuillez réessayer plus tard",
  keyGenerator: (req) => req.auth.userId,
});

const router = Router();

const staff = requireRole("SUPPORT", "ADMIN");
const adminOnly = requireRole("ADMIN");

router.use(authenticate);

// ===================================== READ (SUPPORT and ADMIN) =====================================
router.get("/users", staff, validate({ query: listUsersQuery }), controller.listUsers);
router.get("/users/:id", staff, validate({ params: idParams }), controller.getUser);
router.get(
  "/users/:id/activity",
  staff,
  validate({ params: idParams, query: activityQuery }),
  controller.listActivity,
);

// ===================================== ADMIN ONLY =====================================
router.get("/activity", adminOnly, validate({ query: auditQuery }), controller.listAudit);

router.post(
  "/users/:id/suspend",
  adminOnly,
  validate({ params: idParams, body: reasonBody }),
  controller.suspend,
);
router.post(
  "/users/:id/ban",
  adminOnly,
  validate({ params: idParams, body: reasonBody }),
  controller.ban,
);
router.post(
  "/users/:id/reactivate",
  adminOnly,
  validate({ params: idParams, body: reasonBody }),
  controller.reactivate,
);
router.post(
  "/users/:id/revoke-sessions",
  adminOnly,
  validate({ params: idParams, body: reasonBody }),
  controller.forceLogout,
);
router.patch(
  "/users/:id/role",
  adminOnly,
  validate({ params: idParams, body: changeRoleBody }),
  controller.changeRole,
);
router.patch(
  "/users/:id/profile",
  adminOnly,
  validate({ params: idParams, body: moderateProfileBody }),
  controller.moderateProfile,
);
router.patch(
  "/users/:id/contact",
  adminOnly,
  validate({ params: idParams, body: updateContactBody }),
  controller.updateContact,
);

const reasonRoute = (path, handler) =>
  router.post(path, adminOnly, validate({ params: idParams, body: reasonBody }), handler);

reasonRoute("/users/:id/unlock", controller.unlockAccount);
reasonRoute("/users/:id/deletion/cancel", controller.cancelDeletion);
reasonRoute("/users/:id/export", controller.exportUserData);

// Destructive: step-up code in the body, and a stricter rate limit.
const sensitiveRoute = (path, handler) =>
  router.post(
    path,
    adminOnly,
    validate({ params: idParams, body: stepUpReasonBody }),
    destructiveLimiter,
    handler,
  );

sensitiveRoute("/users/:id/deletion/force", controller.forceDeletion);
sensitiveRoute("/users/:id/reset-password", controller.resetPassword);
sensitiveRoute("/users/:id/reset-2fa", controller.resetTwoFactor);

module.exports = router;
