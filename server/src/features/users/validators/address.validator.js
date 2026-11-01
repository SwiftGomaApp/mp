const { z } = require("zod");
const { drcPhone } = require("../../../core/validation/common");
const { usersConfig } = require("../config/users.config");

const a = usersConfig.addresses;

const optionalText = (max) => z.string().trim().min(1).max(max).nullable().optional();

const shape = {
  label: z.string().trim().min(a.label.minLength).max(a.label.maxLength),
  recipientName: optionalText(a.recipientName.maxLength),
  recipientPhone: drcPhone.nullable().optional(),
  line1: z.string().trim().min(a.line1.minLength).max(a.line1.maxLength),
  quartier: optionalText(a.quartier.maxLength),
  commune: optionalText(a.commune.maxLength),
  city: z.string().trim().min(2).max(80).default(a.defaultCity),
  landmark: optionalText(a.landmark.maxLength),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  isDefault: z.boolean().optional(),
};

const bothOrNeither = {
  check: (b) => (b.latitude == null) === (b.longitude == null),
  params: { message: "Fournissez la latitude et la longitude ensemble", path: ["latitude"] },
};

const createAddressBody = z
  .object(shape)
  .strict()
  .refine(bothOrNeither.check, bothOrNeither.params);

const updateAddressBody = z
  .object(shape)
  .partial()
  .strict()
  .refine((b) => Object.keys(b).length > 0, "Aucune modification fournie")
  .refine(bothOrNeither.check, bothOrNeither.params);

module.exports = { createAddressBody, updateAddressBody };
