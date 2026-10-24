const { z } = require("zod");

const reasonBody = z.object({
  reason: z.string().trim().min(5, "Indiquez la raison").max(500),
});

module.exports = { reasonBody };
