const { z } = require("zod");

const refreshBody = z.object({
  refreshToken: z.string().trim().min(32).max(128).optional(),
});

module.exports = { refreshBody };
