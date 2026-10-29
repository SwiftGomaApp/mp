const { getPrisma } = require("../../../core/db/prisma");
const { AppError } = require("../../../core/errors/AppError");
const { EVENTS } = require("../config/events.config");
const { allowEmailAgain } = require("../../marketing/services/unsubscribe.service");

const DEFAULT_TIMEZONE = "Africa/Lubumbashi";

const CONTEXT_LABELS = {
  SECURITY: "Sécurité",
  PURCHASE: "Mes achats",
  SALE: "Mes ventes",
  DELIVERY: "Livraisons",
  SUPPORT: "Support",
  ADMIN: "Administration",
  ANNOUNCEMENT: "Annonces",
};

function categoriesFor(role) {
  const byContext = new Map();

  for (const event of Object.values(EVENTS)) {
    if (event.roles && !event.roles.includes(role)) continue;
    const entry = byContext.get(event.context) ?? {
      context: event.context,
      label: CONTEXT_LABELS[event.context] ?? event.context,
      channels: new Set(["IN_APP"]),
      total: 0,
      mandatory: 0,
    };
    event.channels.forEach((channel) => entry.channels.add(channel));
    entry.total += 1;
    if (event.mandatory) entry.mandatory += 1;
    byContext.set(event.context, entry);
  }

  return [...byContext.values()].map((entry) => ({
    context: entry.context,
    label: entry.label,
    locked: entry.mandatory === entry.total,
    hasMandatory: entry.mandatory > 0,
    channels: [...entry.channels],
  }));
}

function toSettings(row) {
  return {
    timezone: row?.timezone ?? DEFAULT_TIMEZONE,
    quietHoursEnabled: row?.quietHoursEnabled ?? false,
    quietHoursStart: row?.quietHoursStart ?? null,
    quietHoursEnd: row?.quietHoursEnd ?? null,
    marketingEmailOptIn: row?.marketingEmailOptIn ?? false,
  };
}

async function getPreferences(userId, role) {
  const prisma = getPrisma();
  const [overrides, settings] = await Promise.all([
    prisma.notificationPreference.findMany({ where: { userId, enabled: false } }),
    prisma.notificationSettings.findUnique({ where: { userId } }),
  ]);
  const off = new Set(overrides.map((row) => `${row.context}:${row.channel}`));

  const categories = categoriesFor(role).map((category) => ({
    context: category.context,
    label: category.label,
    locked: category.locked,
    hasMandatory: category.hasMandatory,
    channels: category.channels.map((channel) => {
      const locked = channel === "IN_APP" || category.locked;
      return {
        channel,
        locked,
        enabled: locked || !off.has(`${category.context}:${channel}`),
      };
    }),
  }));

  return { categories, settings: toSettings(settings) };
}

async function updatePreferences(userId, role, items) {
  const prisma = getPrisma();
  const categories = new Map(categoriesFor(role).map((category) => [category.context, category]));

  const latest = new Map();
  for (const item of items) latest.set(`${item.context}:${item.channel}`, item);

  const operations = [];
  for (const { context, channel, enabled } of latest.values()) {
    const category = categories.get(context);
    if (!category || !category.channels.includes(channel)) {
      throw AppError.badRequest(
        "Cette catégorie ou ce canal n'est pas disponible",
        undefined,
        "PREFERENCE_UNAVAILABLE",
      );
    }
    if (category.locked) {
      throw AppError.forbidden(
        "Ces notifications ne peuvent pas être désactivées",
        "PREFERENCE_LOCKED",
      );
    }
    operations.push(
      enabled
        ? prisma.notificationPreference.deleteMany({ where: { userId, context, channel } })
        : prisma.notificationPreference.upsert({
            where: { userId_context_channel: { userId, context, channel } },
            create: { userId, context, channel, enabled: false },
            update: { enabled: false },
          }),
    );
  }

  await prisma.$transaction(operations);
  return getPreferences(userId, role);
}

async function updateSettings(userId, patch) {
  const prisma = getPrisma();
  const current = await prisma.notificationSettings.findUnique({ where: { userId } });
  const pick = (key, fallback) =>
    patch[key] !== undefined ? patch[key] : (current?.[key] ?? fallback);

  const next = {
    timezone: pick("timezone", DEFAULT_TIMEZONE),
    quietHoursEnabled: pick("quietHoursEnabled", false),
    quietHoursStart: pick("quietHoursStart", null),
    quietHoursEnd: pick("quietHoursEnd", null),
    marketingEmailOptIn: pick("marketingEmailOptIn", false),
  };

  if (
    next.quietHoursEnabled &&
    (next.quietHoursStart == null ||
      next.quietHoursEnd == null ||
      next.quietHoursStart === next.quietHoursEnd)
  ) {
    throw AppError.badRequest(
      "Définissez une plage horaire valide",
      undefined,
      "INVALID_QUIET_HOURS",
    );
  }

  const consentChanged =
    patch.marketingEmailOptIn !== undefined &&
    patch.marketingEmailOptIn !== (current?.marketingEmailOptIn ?? false);

  const data = {
    ...next,
    ...(consentChanged
      ? { marketingEmailOptedAt: next.marketingEmailOptIn ? new Date() : null }
      : {}),
  };

  const row = await prisma.notificationSettings.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  if (consentChanged && next.marketingEmailOptIn) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user?.email) await allowEmailAgain(user.email);
  }

  return toSettings(row);
}

module.exports = { getPreferences, updatePreferences, updateSettings, categoriesFor };
