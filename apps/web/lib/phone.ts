export const DRC_COUNTRY_CODE = "243";

// A DRC mobile number is 9 digits (the leading 0 is dropped) starting with 8 or 9.
const DRC_MOBILE_PATTERN = /^[89]\d{8}$/;

export interface DrcPhone {
  /** Digits after the country code, without the trunk 0. Example: "812345678". */
  national: string;
  /** Whether `national` is a complete, valid DRC mobile number. */
  valid: boolean;
  /** Storage/API format. Example: "+243812345678". Null when invalid. */
  e164: string | null;
  /** Display format. Example: "+243 81 234 5678". Null when invalid. */
  international: string | null;
  /** Local dialing format. Example: "081 234 5678". Null when invalid. */
  local: string | null;
}

/**
 * Accepts the many ways a Congolese number gets typed or pasted and reduces it to its national digits:
 * "0812345678", "812 345 678", "+243 81 234 5678", "00243812345678", "243-81-234-5678", "+243 (0) 81 234 5678".
 */
export function toDrcNationalDigits(input: string) {
  return input
    .replace(/\D/g, "")
    .replace(new RegExp(`^(00)?${DRC_COUNTRY_CODE}`), "")
    .replace(/^0/, "");
}

/** Progressive display format used while typing: "81", "81 234", "81 234 5678". */
export function formatDrcNational(input: string) {
  const digits = toDrcNationalDigits(input);

  // Extra digits are kept in the last group so an over-long number stays visibly invalid.
  return [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5)].filter(Boolean).join(" ");
}

export function parseDrcPhone(input: string): DrcPhone {
  const national = toDrcNationalDigits(input);
  const valid = DRC_MOBILE_PATTERN.test(national);

  if (!valid) {
    return { national, valid, e164: null, international: null, local: null };
  }

  const formatted = formatDrcNational(national);

  return {
    national,
    valid,
    e164: `+${DRC_COUNTRY_CODE}${national}`,
    international: `+${DRC_COUNTRY_CODE} ${formatted}`,
    local: `0${formatted}`,
  };
}
