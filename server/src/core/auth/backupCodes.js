const crypto = require("crypto");
const { sha256 } = require("../crypto/crypto");

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 10;
const DEFAULT_COUNT = 10;

function normalizeBackupCode(code) {
  return String(code ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function hashBackupCode(code) {
  return sha256(normalizeBackupCode(code));
}

function generateBackupCodes(count = DEFAULT_COUNT) {
  return Array.from({ length: count }, () => {
    let raw = "";
    for (let i = 0; i < CODE_LENGTH; i++) raw += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
    const display = `${raw.slice(0, 5)}-${raw.slice(5)}`;
    return { code: display, hash: hashBackupCode(display) };
  });
}

module.exports = { generateBackupCodes, hashBackupCode, normalizeBackupCode };
