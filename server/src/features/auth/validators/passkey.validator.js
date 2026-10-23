const { z } = require("zod");
const { device } = require("./signup.validator");

const credential = z.looseObject({
  id: z.string().min(1).max(1024),
  rawId: z.string().min(1).max(1024),
  type: z.literal("public-key"),
  response: z.looseObject({}),
});

const name = z.string().trim().min(1).max(60);

const registerPasskeyBody = z.object({
  response: credential,
  name: name.optional(),
  deviceId: z.string().trim().min(8).max(128).optional(),
});

const renamePasskeyBody = z.object({ name });

const loginPasseyBody = z.object({
  challengeId: z.string().trim().min(32).max(128),
  response: credential,
  device,
});

module.exports = { registerPasskeyBody, renamePasskeyBody, loginPasseyBody };
