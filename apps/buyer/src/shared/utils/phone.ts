export const COUNTRY_CODE = "+243";
export const LOCAL_PHONE_LENGTH = 9;

/** Keeps only the 9 local digits of a Congolese number, whatever way the user typed or pasted it. */
export function toLocalDigits(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("243") && digits.length > LOCAL_PHONE_LENGTH) {
    digits = digits.slice(3);
  }
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.slice(0, LOCAL_PHONE_LENGTH);
}

/** "+243" and 9 local digits as "+243 812 345 678". */
export function formatPhone(localDigits: string): string {
  const groups = localDigits.match(/.{1,3}/g) ?? [];
  return [COUNTRY_CODE, ...groups].join(" ");
}
