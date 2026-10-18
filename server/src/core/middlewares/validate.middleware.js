const { z } = require("zod");

const PARTS = ["params", "query", "body"];

function validate(schemas) {
  return async (req, res, next) => {
    try {
      const validated = {};
      const issues = [];

      for (const part of PARTS) {
        if (!schemas[part]) continue;
        const result = await schemas[part].safeParseAsync(req[part] ?? {});
        if (result.success) validated[part] = result.data;
        else issues.push(...result.error.issues);
      }

      if (issues.length) return next(new z.ZodError(issues));

      if (validated.body !== undefined) req.body = validated.body;
      if (validated.params !== undefined) req.params = validated.params;
      req.validated = validated;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { validate };
