import { defineConfig } from "tsdown";

const shared = {
  format: ["esm", "cjs"],
  platform: "neutral",
  target: "es2020",
  dts: true,
  sourcemap: true,
} as const;

export default defineConfig([
  {
    ...shared,
    entry: {
      index: "src/index.ts",
      "native/index": "src/native/index.ts",
      "web/index": "src/web/index.ts",
      "testing/index": "src/testing/index.ts",
      "web/server/index": "src/web/server/index.ts",
      "account/index": "src/account/index.ts",
      "staff/index": "src/staff/index.ts",
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
