const express = require("express");
const controller = require("../controllers/webhook.controller");

const router = express.Router();

// Africa's Talking posts delivery reports as a form. Providers cannot sign these, so the
// callback URL carries a secret key (?key=...) that is compared in constant time.
router.post(
  "/sms",
  express.urlencoded({ extended: false, limit: "10kb" }),
  controller.smsReport,
);

module.exports = router;
