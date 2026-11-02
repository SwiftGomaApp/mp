const { logger } = require("../../../core/logger/logger");
const { notify } = require("../../notifications/notify");

// `contacts` ({ email, phone }) sends the alert to those addresses instead of the current ones,
// to warn a contact that was just replaced.
async function notifySecurityChange(userOrId, type, { contacts } = {}) {
  try {
    const userId = typeof userOrId === "string" ? userOrId : userOrId.id;
    await notify({
      event: "security.alert",
      userId,
      data: { type, date: new Date().toISOString() },
      contacts,
    });
  } catch (err) {
    logger.warn({ err, type }, "Failed to raise security alert");
  }
}

module.exports = { notifySecurityChange };
