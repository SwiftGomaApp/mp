const { z } = require("zod");
const { drcPhone } = require("../../../core/validation/common");
const { usersConfig } = require("../config/users.config");

const p = usersConfig.preferences;

const updatePreferencesBody = z
  .object({
    theme: z.enum(p.themes),
    dataSaver: z.boolean(),
    preferredMomoNumber: drcPhone.nullable(),
    reviewNameDisplay: z.enum(p.reviewNameDisplays),
    newOrderSound: z.enum(p.newOrderSounds),
  })
  .partial()
  .strict()
  .refine((b) => Object.keys(b).length > 0, "Aucune modification fournie");

module.exports = { updatePreferencesBody };
