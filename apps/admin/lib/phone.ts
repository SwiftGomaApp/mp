export const DRC_COUNTRY_CODE = "243";

const DRC_MOBILE_PATTERN = /^[89]\d{8}$/;

export interface DrcPhone {
  national: string;
  valid: boolean;
  e164: string | null;
  international: string | null;
  local: string | null;
}

export function toDrcNationalDigits(input: string) {
  return input
    .replace(/\D/g, "")
    .replace(new RegExp(`^(00)?${DRC_COUNTRY_CODE}`), "")
    .replace(/^0/, "");
}

export function formatDrcNational(input: string) {
  const digits = toDrcNationalDigits(input);

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
