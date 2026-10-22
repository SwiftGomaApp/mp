const { Router } = require("express");

const router = Router();

router.use("/health", require("./features/health"));
router.use("/auth", require("./features/auth"));

module.exports = router;
