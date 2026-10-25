const { z } = require("zod");

const stepUpCode = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Code invalide");

module.exports = { stepUpCode };
