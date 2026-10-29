import { defineConfig } from "vitest/config";

// Same as vitest.integration.config.mjs, with a setup that works on Windows.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.itest.mjs"],
    globalSetup: ["tests/integration/windowsGlobalSetup.mjs"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
    env: { LOG_LEVEL: "silent" },
  },
});
