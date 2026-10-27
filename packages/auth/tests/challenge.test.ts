import { describe, expect, it } from "vitest";
import { ChallengeStore } from "../src/core/challenge";

describe("ChallengeStore", () => {
  it("keeps a challenge until it expires", () => {
    let now = 1_000;
    const store = new ChallengeStore(() => now);

    store.set("token", "verify", 300);
    expect(store.get()).toEqual({ token: "token", kind: "verify", expiresAt: 301_000 });

    now = 300_999;
    expect(store.get()?.token).toBe("token");

    now = 301_000;
    expect(store.get()).toBeNull();
  });

  it("replaces and clears", () => {
    const store = new ChallengeStore(() => 0);
    store.set("first", "verify", 300);
    store.set("second", "enroll", 300);
    expect(store.get()?.token).toBe("second");
    expect(store.get()?.kind).toBe("enroll");

    store.clear();
    expect(store.get()).toBeNull();
  });
});
