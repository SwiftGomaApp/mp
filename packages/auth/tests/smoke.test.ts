import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "../src/core/index";
import { PLATFORM as NATIVE } from "../src/native/index";
import { PLATFORM as WEB } from "../src/web/index";

describe("package entry points", () => {
  it("exposes the package name from the core entry", () => {
    expect(PACKAGE_NAME).toBe("@swiftgoma/auth");
  });

  it("identifies the native and web entries", () => {
    expect(NATIVE).toBe("native");
    expect(WEB).toBe("web");
  });
});
