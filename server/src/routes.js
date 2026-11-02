const { Router } = require("express");

const router = Router();

router.use("/health", require("./features/health"));
router.use("/auth", require("./features/auth"));
router.use("/admin/verification", require("./features/verification/routes/review.routes"));
router.use("/admin", require("./features/admin"));
router.use("/notifications", require("./features/notifications"));
router.use("/webhooks", require("./features/notifications/routes/webhooks.routes"));
router.use("/marketing", require("./features/marketing"));
router.use("/users", require("./features/users"));
router.use("/verification", require("./features/verification"));

module.exports = router;
