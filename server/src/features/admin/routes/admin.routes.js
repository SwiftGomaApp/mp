const { Router } = require("express");
const controller = require("../controllers/admin.controller");
const { validate } = require("../../../core/middlewares/validate.middleware");
const { authenticate, requireRole } = require("../../../core/middlewares/auth.middleware");
const { idParams } = require("../../../core/validation/common");
const { reasonBody } = require("../validators/admin.validator");

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

module.exports = router;
