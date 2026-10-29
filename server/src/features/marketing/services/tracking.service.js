const { getPrisma } = require("../../../core/db/prisma");
const { logger } = require("../../../core/logger/logger");
const links = require("./links");

// A 1x1 transparent GIF.
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

function isHttpUrl(value) {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

async function record({ campaignId, recipientId, type, url, userAgent }) {
  try {
    await getPrisma().trackingEvent.create({
      data: {
        campaignId,
        recipientId: recipientId ?? null,
        type,
        url: url ?? null,
        userAgent: userAgent ? String(userAgent).slice(0, 255) : null,
      },
    });
  } catch (err) {
    logger.debug({ err, type }, "Could not record a tracking event");
  }
}

async function recordOpen(token, userAgent) {
  const payload = links.verify(token);
  if (payload?.t !== "o") return false;
  await record({ campaignId: payload.c, recipientId: payload.r, type: "OPEN", userAgent });
  return true;
}

/**
 * Returns where a tracked link leads, or null for a forged or broken token. Only addresses
 * that were signed into the email can ever be redirected to.
 */
async function resolveClick(token, userAgent) {
  const payload = links.verify(token);
  if (payload?.t !== "c" || !isHttpUrl(payload.u)) return null;
  await record({
    campaignId: payload.c,
    recipientId: payload.r,
    type: "CLICK",
    url: payload.u,
    userAgent,
  });
  return payload.u;
}

module.exports = { PIXEL, recordOpen, resolveClick, isHttpUrl };
