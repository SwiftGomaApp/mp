import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/core/index.ts",
    "native/index": "src/native/index.ts",
    "web/index": "src/web/index.ts",
  },
  format: ["esm", "cjs"],
  platform: "neutral",
  fixedExtension: true,
  target: "es2022",
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: "dist",
});
