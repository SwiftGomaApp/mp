import { createRequire } from "node:module";
import express from "express";

const require = createRequire(import.meta.url);

const { requestId } = require("../../src/core/middlewares/requestId.middleware");
const { notFoundHandler, errorHandler } = require("../../src/core/middlewares/error.middleware");
const { validate } = require("../../src/core/middlewares/validate.middleware");
const { AppError } = require("../../src/core/errors/AppError");
const { z } = require("zod");
const { drcPhone, email, idParams, pagination } = require("../../src/core/validation/common");

export function createTestApp() {
  const app = express();

  app.use(requestId);
  app.use(express.json());

  app.get("/app-error", () => {
    throw AppError.notFound("Boutique introuvable", "SHOP_NOT_FOUND");
  });

  app.get("/boom", () => {
    throw new Error("secret internal detail");
  });

  app.post(
    "/validated",
    validate({
      body: z.object({ email, phone: drcPhone, age: z.number().min(18) }),
    }),
    (req, res) => res.json({ body: req.body }),
  );

  app.get("/items/:id", validate({ params: idParams, query: pagination }), (req, res) =>
    res.json({ id: req.params.id, query: req.validated.query }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
