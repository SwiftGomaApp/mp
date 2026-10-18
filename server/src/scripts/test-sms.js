const { loadConfig } = require("../config/env.config");
const { sendOtpSms } = require("../core/messaging/sms.service");
const { generateOtp } = require("../core/crypto/crypto");

async function main() {
  const phone = process.argv[2];

  if (!phone) {
    console.error("Usage: node scripts/test-sms.js +243XXXXXXXXX");
    process.exit(1);
  }

  const config = await loadConfig();

  console.log("Mode:", config.sms.dryRun ? "DRY RUN (nothing sent)" : "LIVE");
  console.log("Username:", config.sms.username === "sandbox" ? "sandbox" : "live account");
  console.log("Sender ID:", config.sms.senderId || "(none)");

  const result = await sendOtpSms({
    to: phone,
    code: generateOtp(6),
    expiresMinutes: 5,
  });

  console.log("Result:", result);
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err.code || err.name, "-", err.message);
  process.exit(1);
});
