const { z } = require("zod");

const CONTEXTS = [
  "SECURITY",
  "PURCHASE",
  "SALE",
  "DELIVERY",
  "SUPPORT",
  "ADMIN",
  "ANNOUNCEMENT",
  "MARKETING",
];

function isValidTimeZone(value) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const context = z.enum(CONTEXTS);
const minutes = z.number().int().min(0).max(1439);
const providerId = z.string().trim().min(8).max(128);
const readAllBody = z.object({ context: context.optional() });
const deviceParams = z.object({ subscriptionId: providerId });

const analyticsQuery = z.object({ days: z.coerce.number().int().min(1).max(90).default(7) });

const deliveryLookupQuery = z
  .object({
    userId: z.uuid().optional(),
    email: z.string().trim().toLowerCase().pipe(z.email()).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30),
  })
  .refine((query) => Boolean(query.userId) !== Boolean(query.email), {
    message: "Fournissez soit un identifiant, soit un e-mail",
    path: ["userId"],
  });

const listQuery = z.object({
  cursor: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  context: context.optional(),
  unread: z.stringbool().optional(),
});

const preferencesBody = z.object({
  preferences: z
    .array(
      z.object({
        context,
        channel: z.enum(["PUSH", "SMS", "EMAIL"]),
        enabled: z.boolean(),
      }),
    )
    .min(1)
    .max(30),
});

const settingsBody = z
  .object({
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .refine(isValidTimeZone, "Fuseau horaire invalide")
      .optional(),
    quietHoursEnabled: z.boolean().optional(),
    quietHoursStart: minutes.nullable().optional(),
    quietHoursEnd: minutes.nullable().optional(),
    marketingEmailOptIn: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, "Aucune modification");

const deviceBody = z.object({
  subscriptionId: providerId,
  deviceId: providerId,
  platform: z.enum(["ANDROID", "IOS", "WEB"]),
});

module.exports = {
  listQuery,
  readAllBody,
  preferencesBody,
  settingsBody,
  deviceBody,
  deviceParams,
  analyticsQuery,
  deliveryLookupQuery,
};
