const { logger } = require("../../../core/logger/logger");
const { notify } = require("../../notifications/notify");

async function notifySecurityChange(userOrId, type) {
  try {
    const userId = typeof userOrId === "string" ? userOrId : userOrId.id;
    await notify({
      event: "security.alert",
      userId,
      data: { type, date: new Date().toISOString() },
    });
  } catch (err) {
    logger.warn({ err, type }, "Failed to raise security alert");
  }
}

module.exports = { notifySecurityChange };
