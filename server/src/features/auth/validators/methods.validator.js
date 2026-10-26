const { z } = require("zod");

const methodParams = z.object({ method: z.enum(["EMAIL", "PHONE", "GOOGLE", "APPLE"]) });

const removeMethodBody = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Code invalide"),
});

module.exports = { methodParams, removeMethodBody };
