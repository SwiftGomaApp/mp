import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "native/index": "src/native/index.ts",
    "web/index": "src/web/index.ts",
  },
  format: ["esm", "cjs"],
  platform: "neutral",
  target: "es2020",
  dts: true,
  clean: true,
  sourcemap: true,
});
