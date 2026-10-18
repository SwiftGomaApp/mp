import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.mjs"],
    env: {
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
    },
  },
});
