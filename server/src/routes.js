const { Router } = require("express");

const router = Router();

router.use("/health", require("./features/health"));

module.exports = router;