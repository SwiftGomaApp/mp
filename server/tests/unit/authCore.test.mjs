import jwt from "jsonwebtoken";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { loadWithMocks } from "../helpers/mockModules.mjs";
import { totpCode } from "../helpers/totp.mjs";

const require = createRequire(import.meta.url);
const backupCodes = require("../../src/core/auth/backupCodes");
const password = require("../../src/core/auth/password");
const { sha256 } = require("../../src/core/crypto/crypto");

const authSettings = {
  accessSecret: "s".repeat(40),
  accessTtlSeconds: 900,
  refreshTtlDays: 7,
  totpKey: Buffer.alloc(32, 3),
  totpIssuer: "SwiftGoma",
};
const config = (auth = authSettings) => ({ getConfig: () => ({ auth }) });

const totp = loadWithMocks("core/auth/totp.js", { "config/env.config.js": config() });
const tokens = loadWithMocks("core/auth/tokens.js", { "config/env.config.js": config() });

describe("backup codes", () => {
  it("generates readable codes without ambiguous characters", () => {
    const codes = backupCodes.generateBackupCodes(10);
    expect(codes).toHaveLength(10);
    for (const { code } of codes) expect(code).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
    expect(new Set(codes.map((c) => c.code)).size).toBe(10);
  });

  it("hashes the code that was displayed", () => {
    const [{ code, hash }] = backupCodes.generateBackupCodes(1);
    expect(backupCodes.hashBackupCode(code)).toBe(hash);
  });

  it("ignores case, dashes and spaces when comparing", () => {
    const reference = backupCodes.hashBackupCode("ABCDE-FGHJK");
    expect(backupCodes.hashBackupCode("abcde fghjk")).toBe(reference);
    expect(backupCodes.hashBackupCode(" ABCDEFGHJK ")).toBe(reference);
    expect(backupCodes.hashBackupCode("ABCDE-FGHJL")).not.toBe(reference);
    expect(backupCodes.normalizeBackupCode(null)).toBe("");
  });
});

describe("passwords", () => {
  it("never stores the password and salts every hash", async () => {
    const first = await password.hashPassword("Secret123");
    const second = await password.hashPassword("Secret123");
    expect(first).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(first).not.toContain("Secret123");
    expect(first).not.toBe(second);
  });

  it("accepts the right password and rejects anything else", async () => {
    const stored = await password.hashPassword("Secret123");
    expect(await password.verifyPassword("Secret123", stored)).toBe(true);
    expect(await password.verifyPassword("secret123", stored)).toBe(false);
    expect(await password.verifyPassword("", stored)).toBe(false);
  });

  it("rejects missing or malformed hashes without throwing", async () => {
    expect(await password.verifyPassword("x", null)).toBe(false);
    expect(await password.verifyPassword("x", "")).toBe(false);
    expect(await password.verifyPassword("x", "bcrypt$10$abc$def")).toBe(false);
    expect(await password.verifyPassword("x", "scrypt$1$1$1$AAAA")).toBe(false);
  });

  it("asks for a rehash when the parameters are weaker than today's", async () => {
    const current = await password.hashPassword("Secret123");
    expect(password.needsRehash(current)).toBe(false);
    expect(password.needsRehash(current.replace("$32768$", "$16384$"))).toBe(true);
    expect(password.needsRehash("bcrypt$10$abc$def")).toBe(true);
    expect(password.needsRehash("scrypt$32768$8$1$AA==$AAAA")).toBe(true);
  });
});

describe("TOTP", () => {
  const rfcSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

  it("matches the RFC 6238 test vectors", () => {
    expect(totp.verifyTotp({ secret: rfcSecret, code: "287082", now: 59_000 })).toBe(1);
    expect(totp.verifyTotp({ secret: rfcSecret, code: "081804", now: 1_111_111_109_000 })).toBe(
      37_037_036,
    );
    expect(totp.verifyTotp({ secret: rfcSecret, code: "005924", now: 1_234_567_890_000 })).toBe(
      41_152_263,
    );
  });

  it("creates a 160-bit base32 secret", () => {
    const secret = totp.generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(totp.generateTotpSecret()).not.toBe(secret);
  });

  it("tolerates one step of clock drift but not two", () => {
    const now = 1_700_000_000_000;
    const at = (offset) => totpCode(rfcSecret, now + offset * 30_000);
    const accepts = (code) => totp.verifyTotp({ secret: rfcSecret, code, now }) !== null;

    expect(accepts(at(0))).toBe(true);
    expect(accepts(at(-1))).toBe(true);
    expect(accepts(at(1))).toBe(true);
    expect(accepts(at(-2))).toBe(false);
    expect(accepts(at(2))).toBe(false);
  });

  it("refuses to accept a step that was already used", () => {
    const step = totp.verifyTotp({ secret: rfcSecret, code: "287082", now: 59_000 });
    expect(
      totp.verifyTotp({ secret: rfcSecret, code: "287082", now: 59_000, lastUsedStep: step }),
    ).toBeNull();
  });

  it("ignores spaces and refuses malformed codes", () => {
    expect(totp.verifyTotp({ secret: rfcSecret, code: "287 082", now: 59_000 })).toBe(1);
    for (const code of ["28708", "2870821", "abcdef", "", null, undefined]) {
      expect(totp.verifyTotp({ secret: rfcSecret, code, now: 59_000 })).toBeNull();
    }
  });

  it("encrypts the secret so it can only be read back with the key", () => {
    const secret = totp.generateTotpSecret();
    const encrypted = totp.encryptSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(totp.encryptSecret(secret)).not.toBe(encrypted);
    expect(totp.decryptSecret(encrypted)).toBe(secret);

    const tampered = `${encrypted.slice(0, -2)}AA`;
    expect(() => totp.decryptSecret(tampered)).toThrow();
  });

  it("builds the QR code address with issuer, period and digits", () => {
    const uri = totp.buildOtpauthUri({ secret: rfcSecret, accountName: "a@example.com" });
    expect(uri).toContain("otpauth://totp/SwiftGoma:a%40example.com");
    expect(uri).toContain(`secret=${rfcSecret}`);
    expect(uri).toContain("period=30");
    expect(uri).toContain("digits=6");
  });
});

describe("access and refresh tokens", () => {
  const claims = { userId: "user-1", role: "BUYER", sessionId: "session-1" };

  it("round-trips the user, role and session", () => {
    expect(tokens.verifyAccessToken(tokens.signAccessToken(claims))).toEqual(claims);
  });

  it("is signed with HS256 for this API and audience only", () => {
    const decoded = jwt.decode(tokens.signAccessToken(claims), { complete: true });
    expect(decoded.header.alg).toBe("HS256");
    expect(decoded.payload).toMatchObject({
      iss: "swiftgoma-api",
      aud: "swiftgoma-app",
      sub: "user-1",
      sid: "session-1",
    });
    expect(decoded.payload.exp - decoded.payload.iat).toBe(900);
  });

  it("rejects tokens signed with another secret", () => {
    const forged = jwt.sign({ role: "ADMIN", sid: "s" }, "x".repeat(40), {
      algorithm: "HS256",
      subject: "user-1",
      issuer: "swiftgoma-api",
      audience: "swiftgoma-app",
    });
    expect(() => tokens.verifyAccessToken(forged)).toThrow();
  });

  it("rejects unsigned tokens and other issuers or audiences", () => {
    const unsigned = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from(
      '{"sub":"user-1","role":"ADMIN"}',
    ).toString("base64url")}.`;
    expect(() => tokens.verifyAccessToken(unsigned)).toThrow();

    for (const options of [
      { issuer: "other", audience: "swiftgoma-app" },
      { issuer: "swiftgoma-api", audience: "other" },
    ]) {
      const token = jwt.sign({ role: "BUYER", sid: "s" }, authSettings.accessSecret, {
        algorithm: "HS256",
        subject: "user-1",
        ...options,
      });
      expect(() => tokens.verifyAccessToken(token)).toThrow();
    }
  });

  it("rejects expired tokens", () => {
    const expired = loadWithMocks("core/auth/tokens.js", {
      "config/env.config.js": config({ ...authSettings, accessTtlSeconds: -10 }),
    });
    const token = expired.signAccessToken(claims);
    expect(() => tokens.verifyAccessToken(token)).toThrow(/expired/);
  });

  it("issues opaque refresh tokens and stores only their hash", () => {
    const refresh = tokens.generateRefreshToken();
    expect(refresh.token).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(refresh.hash).toBe(sha256(refresh.token));
    expect(tokens.hashRefreshToken(refresh.token)).toBe(refresh.hash);
    expect(tokens.generateRefreshToken().token).not.toBe(refresh.token);

    const days = (refresh.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(6.99);
    expect(days).toBeLessThanOrEqual(7);
  });
});
