import { ERROR_CODES, hasErrorCode } from "@swiftgoma/auth";
import { useState } from "react";
import { Keyboard } from "react-native";

import { auth } from "@/core/auth/auth";
import { getErrorMessage } from "@/core/auth/error-message";

import { registerCodeDialog } from "../login-dialogs";
import { useContactInput } from "./use-contact-input";

const NAME_MIN_LENGTH = 2;

const REOPEN_DELAY_MS = 500;

export function useRegisterForm() {
  const contact = useContactInput();
  const [name, setName] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [accountExists, setAccountExists] = useState(false);
  const [codeError, setCodeError] = useState<string>();

  const trimmedName = name.trim();

  const isValid = trimmedName.length >= NAME_MIN_LENGTH && contact.isValid && ageConfirmed;

  const clearErrors = () => {
    setError(undefined);
    setAccountExists(false);
  };

  const submit = async () => {
    if (!isValid || busy) return;
    Keyboard.dismiss();
    clearErrors();
    setCodeError(undefined);
    setBusy(true);

    try {
      if (contact.mode === "email") {
        await auth.signup.email.start({
          name: trimmedName,
          email: contact.email.trim(),
          role: "BUYER",
          acceptTerms: true,
          confirmAge: true,
        });
      } else {
        await auth.signup.phone.start({
          name: trimmedName,
          phone: contact.countryCode + contact.phone,
          role: "BUYER",
          acceptTerms: true,
          confirmAge: true,
        });
      }
      registerCodeDialog.open();
    } catch (caught) {
      setError(getErrorMessage(caught));
      setAccountExists(hasErrorCode(caught, ERROR_CODES.ACCOUNT_EXISTS));
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (code: string) => {
    if (busy) return;
    setBusy(true);

    try {
      if (contact.mode === "email") {
        await auth.signup.email.verify({ email: contact.email.trim(), code });
      } else {
        await auth.signup.phone.verify({ phone: contact.countryCode + contact.phone, code });
      }
    } catch (caught) {
      if (hasErrorCode(caught, ERROR_CODES.OTP_INVALID)) {
        setCodeError(getErrorMessage(caught));
        setTimeout(() => registerCodeDialog.open(), REOPEN_DELAY_MS);
      } else {
        setError(getErrorMessage(caught));
      }
    } finally {
      setBusy(false);
    }
  };

  return {
    ...contact,
    setEmail: (value: string) => {
      clearErrors();
      contact.setEmail(value);
    },
    setPhone: (raw: string) => {
      clearErrors();
      contact.setPhone(raw);
    },
    switchMode: () => {
      clearErrors();
      contact.switchMode();
    },
    name,
    setName,
    ageConfirmed,
    setAgeConfirmed,
    isValid,
    busy,
    error,
    accountExists,
    codeError,
    submit,
    verifyCode,
  };
}
