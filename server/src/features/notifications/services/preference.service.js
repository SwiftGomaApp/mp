const { getPrisma } = require("../../../core/db/prisma");

function minutesNow(timezone, now) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour").value);
  const minute = Number(parts.find((p) => p.type === "minute").value);
  return hour * 60 + minute;
}

function inQuietHours(settings, now = new Date()) {
  if (!settings?.quietHoursEnabled) return false;
  const { quietHoursStart: start, quietHoursEnd: end } = settings;
  if (start == null || end == null) return false;

  let current;
  try {
    current = minutesNow(settings.timezone, now);
  } catch {
    return false;
  }

  return start <= end ? current >= start && current < end : current >= start || current < end;
}

async function loadPreferences(userIds) {
  const prisma = getPrisma();
  const [overrides, settings] = await Promise.all([
    prisma.notificationPreference.findMany({ where: { userId: { in: userIds } } }),
    prisma.notificationSettings.findMany({ where: { userId: { in: userIds } } }),
  ]);

  const byUser = new Map(userIds.map((id) => [id, { overrides: new Map(), settings: null }]));
  for (const row of overrides) {
    byUser.get(row.userId).overrides.set(`${row.context}:${row.channel}`, row.enabled);
  }
  for (const row of settings) byUser.get(row.userId).settings = row;
  return byUser;
}

function decideChannel({ event, channel, entry, now = new Date() }) {
  if (channel === "IN_APP") return { allowed: true };
  if (event.mandatory) return { allowed: true };

  if (entry?.overrides.get(`${event.context}:${channel}`) === false) {
    return { allowed: false, reason: "preference_off" };
  }

  if (channel === "PUSH" && event.priority !== "CRITICAL" && inQuietHours(entry?.settings, now)) {
    return { allowed: false, reason: "quiet_hours" };
  }

  return { allowed: true };
}

module.exports = { loadPreferences, decideChannel, inQuietHours };
