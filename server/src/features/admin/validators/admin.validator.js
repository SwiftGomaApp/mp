const { z } = require("zod");
const { ActivityEvent } = require("@prisma/client");
const { pagination, email, drcPhone } = require("../../../core/validation/common");

const reasonBody = z.object({
  reason: z.string().trim().min(5, "Indiquez la raison").max(500),
});

const ROLES = ["BUYER", "SELLER", "RIDER", "SUPPORT", "ADMIN"];
const STATUSES = [
  "PENDING",
  "PENDING_APPROVAL",
  "ACTIVE",
  "SUSPENDED",
  "BANNED",
  "DELETED",
  "PENDING_DELETION",
];

const listUsersQuery = pagination.extend({
  q: z.string().trim().min(2).max(100).optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(STATUSES).optional(),
  sort: z.enum(["createdAt", "lastLoginAt"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

const activityQuery = pagination;

const auditQuery = pagination.extend({
  userId: z.uuid().optional(),
  actorId: z.uuid().optional(),
  event: z.enum(Object.values(ActivityEvent)).optional(),
  success: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const changeRoleBody = reasonBody.extend({
  role: z.enum(["BUYER", "SELLER", "RIDER"]),
});

const moderateProfileBody = reasonBody
  .extend({ removeAvatar: z.boolean().default(false), clearName: z.boolean().default(false) })
  .refine((b) => b.removeAvatar || b.clearName, "Aucune action demandée");

// No value: marks the contact as unverified. With a value: replaces it, also unverified.
const updateContactBody = reasonBody.extend({
  field: z.enum(["email", "phone"]),
  value: z.union([email, drcPhone]).optional(),
});

module.exports = {
  reasonBody,
  listUsersQuery,
  activityQuery,
  auditQuery,
  changeRoleBody,
  moderateProfileBody,
  updateContactBody,
};
