const { z } = require("zod");
const { usersConfig } = require("../config/users.config");

const { name } = usersConfig.profile;

const updateProfileBody = z
  .object({
    name: z.string().trim().min(name.minLength).max(name.maxLength),
  })
  .strict();

module.exports = { updateProfileBody };
