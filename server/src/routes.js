const { Router } = require("express");

const router = Router();

router.use("/health", require("./features/health"));
router.use("/auth", require("./features/auth"));
router.use("/admin", require("./features/admin"));

module.exports = router;
