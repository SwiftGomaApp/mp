const { loadConfig } = require("../config/env.config");
const { sendOtpEmail, sendLoginAlertEmail } = require("../core/mail/mail.service");

(async () => {
  await loadConfig();
  await sendOtpEmail({
    to: "swiftgoma@gmail.com",
    name: "Balekage Gael",
    code: "084471",
    expiresMinutes: 5,
  });
  await sendLoginAlertEmail({
    to: "gbalekage21@gmail.com",
    name: "Balekage Gael",
    deviceName: "Samsung Galaxy A54",
    location: "Goma, Nord-Kivu",
    country: "RD Congo",
    date: new Date(),
    activityUrl: "https://swiftgoma.com/securite/activite",
  });
  process.exit(0);
})();
