import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.itest.mjs"],
    globalSetup: ["tests/integration/globalSetup.mjs"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
    env: { LOG_LEVEL: "silent" },
  },
});
