const { z } = require("zod");
const { VerificationDocumentType, VehicleType } = require("@prisma/client");
const { verificationConfig } = require("../config/verification.config");

const { taxNumber } = verificationConfig;

const documentParams = z.object({
  type: z.enum(Object.values(VerificationDocumentType)),
});

// Sent as a multipart field next to the file, so an empty value means "not provided".
const emptyToUndefined = (value) => (value === "" ? undefined : value);

const uploadDocumentBody = z
  .object({
    expiresAt: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  })
  .strict();

const detailsBody = z
  .object({
    taxNumber: z.string().trim().min(taxNumber.minLength).max(taxNumber.maxLength).optional(),
    vehicleType: z.enum(Object.values(VehicleType)).optional(),
    plateNumber: z.string().trim().min(1).max(30).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, "Aucune information fournie");

module.exports = { documentParams, uploadDocumentBody, detailsBody };
