import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "../src/index";
import { ENTRY as NATIVE_ENTRY } from "../src/native/index";
import { ENTRY as WEB_ENTRY } from "../src/web/index";

describe("package skeleton", () => {
  it("exposes the package name", () => {
    expect(PACKAGE_NAME).toBe("swiftgoma-mp-auth");
  });

  it("has one entry per platform", () => {
    expect(NATIVE_ENTRY).toBe("native");
    expect(WEB_ENTRY).toBe("web");
  });
});
