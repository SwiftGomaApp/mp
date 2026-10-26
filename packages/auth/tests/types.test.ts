import { describe, expect, expectTypeOf, it } from "vitest";
import type { AuthUser, CurrentUser, LoginResult } from "../src/core/types";
import type { WireLoginResponse } from "../src/core/wire";

describe("types", () => {
  it("narrow a login result by its status", () => {
    const describeResult = (result: LoginResult) => {
      if (result.status === "authenticated") {
        expectTypeOf(result.user).toEqualTypeOf<AuthUser>();
        expectTypeOf(result.isNewDevice).toEqualTypeOf<boolean>();
        return "in";
      }
      expectTypeOf(result.challengeExpiresIn).toEqualTypeOf<number>();
      return result.status;
    };

    expect(describeResult({ status: "two_factor_required", challengeExpiresIn: 300 })).toBe(
      "two_factor_required",
    );
  });

  it("never expose the second-step token in a login result", () => {
    expectTypeOf<LoginResult>().not.toHaveProperty("challengeToken");
  });

  it("let the current user be used wherever a user is expected", () => {
    const current = {} as CurrentUser;
    const user: AuthUser = current;
    expect(user).toBeDefined();
  });

  it("tell a challenge from a signed-in answer by one field", () => {
    const isChallenge = (response: WireLoginResponse) => "twoFactorRequired" in response;
    expect(isChallenge({ twoFactorRequired: true, challengeToken: "t", expiresIn: 300 })).toBe(
      true,
    );
  });
});
