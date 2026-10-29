const { z } = require("zod");
const { pagination } = require("../../../core/validation/common");

const templateKey = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9._-]{1,62}$/, "Clé invalide (lettres, chiffres, point, tiret)");

const subject = z.string().trim().min(3).max(150);
const preheader = z.string().trim().max(200);
const html = z.string().min(10).max(200_000);
const text = z.string().max(50_000);
const days = (max) => z.number().int().min(1).max(max);

const segmentRules = z
  .object({
    roles: z.array(z.enum(["BUYER", "SELLER", "RIDER"])).max(3).optional(),
    platforms: z.array(z.enum(["ANDROID", "IOS", "WEB"])).max(3).optional(),
    cities: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    lastLoginWithinDays: days(3650).optional(),
    inactiveForDays: days(3650).optional(),
    signedUpWithinDays: days(3650).optional(),
    verificationStatuses: z
      .array(z.enum(["NOT_SUBMITTED", "PENDING", "IN_REVIEW", "APPROVED", "REJECTED"]))
      .max(5)
      .optional(),
  })
  .strict();

const segmentBody = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(300).nullable().optional(),
  rules: segmentRules,
});
const segmentPatch = segmentBody
  .partial()
  .refine((body) => Object.keys(body).length > 0, "Aucune modification");
const previewBody = z.object({ rules: segmentRules });

const templateCreateBody = z.object({
  key: templateKey,
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(300).nullable().optional(),
  subject,
  preheader: preheader.nullable().optional(),
  html,
  text: text.nullable().optional(),
});
const templatePatch = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(300).nullable().optional(),
    subject: subject.optional(),
    preheader: preheader.nullable().optional(),
    html: html.optional(),
    text: text.nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, "Aucune modification");
const templateParams = z.object({ key: templateKey });

const campaignCreateBody = z
  .object({
    name: z.string().trim().min(2).max(100),
    segmentId: z.uuid().nullable().optional(),
    templateKey: templateKey.optional(),
    templateVersion: z.number().int().min(1).optional(),
    subject: subject.optional(),
    preheader: preheader.nullable().optional(),
    html: html.optional(),
    text: text.nullable().optional(),
  })
  .refine((body) => body.templateKey || (body.subject && body.html), {
    message: "Choisissez un modèle ou fournissez un objet et un contenu",
    path: ["templateKey"],
  });

const campaignPatch = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    segmentId: z.uuid().nullable().optional(),
    templateKey: templateKey.optional(),
    templateVersion: z.number().int().min(1).optional(),
    subject: subject.optional(),
    preheader: preheader.nullable().optional(),
    html: html.optional(),
    text: text.nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, "Aucune modification");

const campaignListQuery = pagination.extend({
  status: z.enum(["DRAFT", "SCHEDULED", "SENDING", "SENT", "CANCELLED", "FAILED"]).optional(),
});
const scheduleBody = z.object({ scheduledAt: z.coerce.date() });
const overviewQuery = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });

const suppressionListQuery = pagination.extend({
  reason: z.enum(["UNSUBSCRIBED", "BOUNCED", "COMPLAINED"]).optional(),
  search: z.string().trim().min(1).max(100).optional(),
});
const suppressionBody = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  reason: z.enum(["BOUNCED", "COMPLAINED"]),
});
const recipientsQuery = pagination.extend({
  status: z.enum(["PENDING", "SENT", "FAILED", "SKIPPED"]).optional(),
});

const tokenParams = z.object({ token: z.string().min(10).max(4000) });

module.exports = {
  segmentBody,
  segmentPatch,
  previewBody,
  templateCreateBody,
  templatePatch,
  templateParams,
  campaignCreateBody,
  campaignPatch,
  campaignListQuery,
  scheduleBody,
  overviewQuery,
  suppressionListQuery,
  suppressionBody,
  recipientsQuery,
  tokenParams,
};
