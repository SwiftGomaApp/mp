import { defineConfig, type UserConfig } from "tsdown";

const shared: UserConfig = {
  format: ["esm", "cjs"],
  platform: "neutral",
  target: "es2020",
  dts: true,
  sourcemap: true,
};

export default defineConfig([
  {
    ...shared,
    entry: {
      index: "src/index.ts",
      "realtime/index": "src/realtime/index.ts",
      "native/index": "src/native/index.ts",
      "testing/index": "src/testing/index.ts",
    },
    clean: true,
  },
  {
    // The React entry runs in client components, which Next.js needs to be told.
    ...shared,
    entry: { "react/index": "src/react/index.ts" },
    banner: { js: '"use client";' },
    clean: false,
  },
]);
