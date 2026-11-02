const { z } = require("zod");
const {
  VerificationStatus,
  VerificationType,
  VerificationDocumentType,
  VerificationOpinion,
  CallOutcome,
} = require("@prisma/client");
const { uuid, drcPhone, pagination } = require("../../../core/validation/common");

const NOTE_MAX = 2000;

const caseParams = z.object({ id: uuid });

const caseDocumentParams = z.object({
  id: uuid,
  type: z.enum(Object.values(VerificationDocumentType)),
});

const listQuery = pagination.extend({
  status: z.enum(Object.values(VerificationStatus)).optional(),
  type: z.enum(Object.values(VerificationType)).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  mine: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

const note = z.string().trim().max(NOTE_MAX).optional();

const callBody = z
  .object({
    outcome: z.enum(Object.values(CallOutcome)),
    notes: note,
    phone: drcPhone.optional(),
  })
  .strict();

const opinionBody = z
  .object({
    opinion: z.enum(Object.values(VerificationOpinion)),
    note,
  })
  .strict();

const decisionBody = z.object({ note }).strict();

module.exports = {
  caseParams,
  caseDocumentParams,
  listQuery,
  callBody,
  opinionBody,
  decisionBody,
};
