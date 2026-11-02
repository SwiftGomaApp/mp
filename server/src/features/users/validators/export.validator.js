const { z } = require("zod");
const { stepUpCode } = require("../../auth/validators/stepUp.validator");

const exportDataBody = z.object({ stepUpCode });

module.exports = { exportDataBody };
