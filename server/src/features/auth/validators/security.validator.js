const { z } = require("zod");
const { pagination } = require("../../../core/validation/common");

const activityQuery = pagination.extend({
  category: z.enum(["LOGIN", "DEVICE", "SECURITY"]).optional(),
});

module.exports = { activityQuery };
