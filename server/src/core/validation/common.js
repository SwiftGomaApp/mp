const { z } = require("zod");
const { isValidDrcPhone } = require("./phone");

const drcPhone = z
  .string()
  .trim()
  .refine(isValidDrcPhone, "Numéro invalide, utilisez le format +243XXXXXXXXX");

const email = z.string().trim().toLowerCase().pipe(z.email());

const uuid = z.uuid();

const idParams = z.object({ id: uuid });

const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

module.exports = { drcPhone, email, uuid, idParams, pagination };
