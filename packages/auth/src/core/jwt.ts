const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function decodeBase64Url(input: string): string | null {
  const clean = input.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  let output = "";
  let value = 0;
  let bits = 0;
  for (const char of clean) {
    const index = BASE64_ALPHABET.indexOf(char);
    if (index < 0) return null;
    value = (value << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((value >> bits) & 0xff);
      value &= (1 << bits) - 1;
    }
  }
  return output;
}

export function readJwtExpiry(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  const json = decodeBase64Url(payload);
  if (json === null) return null;
  try {
    const claims: unknown = JSON.parse(json);
    if (typeof claims !== "object" || claims === null) return null;
    const exp = (claims as Record<string, unknown>).exp;
    return typeof exp === "number" && Number.isFinite(exp) ? exp * 1000 : null;
  } catch {
    return null;
  }
}
