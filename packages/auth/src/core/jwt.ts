const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64UrlToString(input: string): string | null {
  const clean = input.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  if (clean.length % 4 === 1) return null;

  let output = "";
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const value = ALPHABET.indexOf(char);
    if (value === -1) return null;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
      buffer &= (1 << bits) - 1;
    }
  }
  return output;
}

export function decodeJwtExpiry(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return null;

  const json = base64UrlToString(parts[1]);
  if (json === null) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch {
    return null;
  }

  if (typeof payload !== "object" || payload === null) return null;
  const exp = (payload as { exp?: unknown }).exp;
  if (typeof exp !== "number" || !Number.isFinite(exp) || exp <= 0) return null;
  return exp * 1000;
}
