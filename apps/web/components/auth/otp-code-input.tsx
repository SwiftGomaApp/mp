"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";

import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export const OTP_CODE_LENGTH = 6;

const SLOT_CLASS =
  "size-11 rounded-lg border text-base first:rounded-l-lg first:border-l last:rounded-r-lg data-[active=true]:border-primary data-[active=true]:ring-primary/30";

interface OtpCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  "aria-label": string;
}

export function OtpCodeInput({
  value,
  onChange,
  disabled,
  invalid,
  autoFocus,
  "aria-label": ariaLabel,
}: OtpCodeInputProps) {
  return (
    <InputOTP
      maxLength={OTP_CODE_LENGTH}
      pattern={REGEXP_ONLY_DIGITS}
      inputMode="numeric"
      autoComplete="one-time-code"
      value={value}
      onChange={onChange}
      disabled={disabled}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
    >
      <InputOTPGroup className="gap-2.5">
        {Array.from({ length: OTP_CODE_LENGTH }, (_, index) => (
          <InputOTPSlot
            key={index}
            index={index}
            className={SLOT_CLASS}
            aria-invalid={invalid || undefined}
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}
