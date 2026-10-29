const { Router } = require("express");
const { validate } = require("../../../core/middlewares/validate.middleware");
const { authenticate, requireRole } = require("../../../core/middlewares/auth.middleware");
const { createLimiter } = require("../../../core/middlewares/rateLimit.middleware");
const { idParams } = require("../../../core/validation/common");
const inbox = require("../controllers/inbox.controller");
const settings = require("../controllers/settings.controller");
const devices = require("../controllers/device.controller");
const adminController = require("../controllers/admin.controller");
const {
  listQuery,
  readAllBody,
  preferencesBody,
  settingsBody,
  deviceBody,
  deviceParams,
  analyticsQuery,
  deliveryLookupQuery,
} = require("../validators/notification.validator");

const writeLimiter = createLimiter({
  name: "notifications-write",
  windowMs: 60 * 1000,
  limit: 60,
  message: "Trop de requêtes, veuillez réessayer dans un instant",
  keyGenerator: (req) => req.auth.userId,
});

const router = Router();

router.use(authenticate);

router.get("/", validate({ query: listQuery }), inbox.list);
router.get("/unread-count", inbox.unreadCount);
router.post("/read-all", validate({ body: readAllBody }), writeLimiter, inbox.readAll);

router.get("/preferences", settings.getPreferences);
router.patch(
  "/preferences",
  validate({ body: preferencesBody }),
  writeLimiter,
  settings.updatePreferences,
);
router.patch("/settings", validate({ body: settingsBody }), writeLimiter, settings.updateSettings);

router.post("/devices", validate({ body: deviceBody }), writeLimiter, devices.register);
router.delete(
  "/devices/:subscriptionId",
  validate({ params: deviceParams }),
  writeLimiter,
  devices.remove,
);

router.get(
  "/admin/analytics",
  requireRole("ADMIN"),
  validate({ query: analyticsQuery }),
  adminController.analytics,
);
router.get(
  "/admin/deliveries",
  requireRole("ADMIN", "SUPPORT"),
  validate({ query: deliveryLookupQuery }),
  adminController.deliveries,
);

router.patch("/:id/read", validate({ params: idParams }), writeLimiter, inbox.read);
router.post("/:id/ack", validate({ params: idParams }), writeLimiter, inbox.ack);
router.delete("/:id", validate({ params: idParams }), writeLimiter, inbox.remove);

module.exports = router;
