const { getPrisma } = require("../../../core/db/prisma");
const { logger } = require("../../../core/logger/logger");

// Africa's Talking delivery report statuses. The field names and values come from a
// third-party integration guide, not the official reference, so confirm them with a real
// callback before relying on them in production.
const DELIVERED = new Set(["success", "delivered"]);
const FAILED = new Set(["failed", "rejected"]);

function classify(status) {
  const value = String(status ?? "").trim().toLowerCase();
  if (DELIVERED.has(value)) return "DELIVERED";
  if (FAILED.has(value)) return "FAILED";
  return null;
}

async function recordSmsReport({ id, status, failureReason }) {
  const outcome = classify(status);
  if (!id || !outcome) return { updated: 0 };

  const data =
    outcome === "DELIVERED"
      ? { status: "DELIVERED", deliveredAt: new Date() }
      : {
          status: "FAILED",
          failedAt: new Date(),
          error: String(failureReason ?? status).slice(0, 500),
        };

  const { count } = await getPrisma().notificationDelivery.updateMany({
    where: { channel: "SMS", providerRef: String(id), status: { in: ["SENT", "PENDING"] } },
    data,
  });

  if (!count) logger.debug({ id, status }, "SMS delivery report matched no delivery");
  return { updated: count };
}

module.exports = { recordSmsReport, classify };
