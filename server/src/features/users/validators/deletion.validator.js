const { z } = require("zod");
const { stepUpCode } = require("../../auth/validators/stepUp.validator");
const { usersConfig } = require("../config/users.config");

const requestDeletionBody = z.object({
  stepUpCode,
  confirmation: z.literal(usersConfig.deletion.confirmationWord, {
    error: `Tapez ${usersConfig.deletion.confirmationWord} pour confirmer`,
  }),
});

module.exports = { requestDeletionBody };
