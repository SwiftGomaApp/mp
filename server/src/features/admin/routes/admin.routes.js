const { Router } = require("express");
const controller = require("../controllers/admin.controller");
const { validate } = require("../../../core/middlewares/validate.middleware");
const { authenticate, requireRole } = require("../../../core/middlewares/auth.middleware");
const { idParams } = require("../../../core/validation/common");
const {
  reasonBody,
  listUsersQuery,
  activityQuery,
  auditQuery,
  changeRoleBody,
  moderateProfileBody,
  updateContactBody,
} = require("../validators/admin.validator");

const router = Router();

router.use(authenticate, requireRole("ADMIN"));

router.post(
  "/users/:id/suspend",
  validate({ params: idParams, body: reasonBody }),
  controller.suspend,
);
router.post("/users/:id/ban", validate({ params: idParams, body: reasonBody }), controller.ban);
router.post(
  "/users/:id/reactivate",
  validate({ params: idParams, body: reasonBody }),
  controller.reactivate,
);

router.get("/users", validate({ query: listUsersQuery }), controller.listUsers);
router.get("/users/:id", validate({ params: idParams }), controller.getUser);
router.get(
  "/users/:id/activity",
  validate({ params: idParams, query: activityQuery }),
  controller.listActivity,
);
router.post(
  "/users/:id/revoke-sessions",
  validate({ params: idParams, body: reasonBody }),
  controller.forceLogout,
);
router.patch(
  "/users/:id/role",
  validate({ params: idParams, body: changeRoleBody }),
  controller.changeRole,
);

const reasonRoute = (path, handler, schema = reasonBody) =>
  router.post(path, validate({ params: idParams, body: schema }), handler);

reasonRoute("/users/:id/unlock", controller.unlockAccount);
reasonRoute("/users/:id/deletion/cancel", controller.cancelDeletion);
reasonRoute("/users/:id/deletion/force", controller.forceDeletion);
reasonRoute("/users/:id/reset-password", controller.resetPassword);
reasonRoute("/users/:id/reset-2fa", controller.resetTwoFactor);
reasonRoute("/users/:id/export", controller.exportUserData);
router.patch(
  "/users/:id/profile",
  validate({ params: idParams, body: moderateProfileBody }),
  controller.moderateProfile,
);
router.patch(
  "/users/:id/contact",
  validate({ params: idParams, body: updateContactBody }),
  controller.updateContact,
);
router.get("/activity", validate({ query: auditQuery }), controller.listAudit);

module.exports = router;
