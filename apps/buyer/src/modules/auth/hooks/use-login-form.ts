import { ERROR_CODES, hasErrorCode } from "@swiftgoma/auth";
import { useState } from "react";
import { Keyboard } from "react-native";

import { auth } from "@/core/auth/auth";
import { getErrorMessage } from "@/core/auth/error-message";

import { loginCodeDialog } from "../login-dialogs";
import { useContactInput, type ContactMode } from "./use-contact-input";

export type LoginMode = ContactMode;

// An iOS alert needs a moment to leave the screen before another one can be shown.
const REOPEN_DELAY_MS = 500;

export function useLoginForm() {
  const contact = useContactInput();

  const [busy, setBusy] = useState(false);
  // Shown under the field.
  const [error, setError] = useState<string>();
  const [accountMissing, setAccountMissing] = useState(false);
  // Shown in the code dialog, after a wrong code.
  const [codeError, setCodeError] = useState<string>();

  const clearErrors = () => {
    setError(undefined);
    setAccountMissing(false);
  };

  // Step 1: ask the server to send a code, then open the dialog that asks for it.
  const submit = async () => {
    if (!contact.isValid || busy) return;
    Keyboard.dismiss();
    clearErrors();
    setCodeError(undefined);
    setBusy(true);

    try {
      if (contact.mode === "email") {
        await auth.login.emailCode.request({ email: contact.email.trim() });
      } else {
        await auth.login.phoneCode.request({ phone: contact.countryCode + contact.phone });
      }
      loginCodeDialog.open();
    } catch (caught) {
      setError(getErrorMessage(caught));
      setAccountMissing(hasErrorCode(caught, ERROR_CODES.ACCOUNT_NOT_FOUND));
    } finally {
      setBusy(false);
    }
  };

  // Step 2: check the code. On success the package saves the session; the router then leaves
  // the login screen by itself.
  const verifyCode = async (code: string) => {
    if (busy) return;
    setBusy(true);

    try {
      const result =
        contact.mode === "email"
          ? await auth.login.emailCode.verify({ email: contact.email.trim(), code })
          : await auth.login.phoneCode.verify({ phone: contact.countryCode + contact.phone, code });

      if (result.status !== "authenticated") {
        // The two-step code is handled in a later step.
        setError("La double vérification n'est pas encore disponible dans l'application.");
      }
    } catch (caught) {
      if (hasErrorCode(caught, ERROR_CODES.OTP_INVALID)) {
        // A wrong code: ask again, with the reason.
        setCodeError(getErrorMessage(caught));
        setTimeout(() => loginCodeDialog.open(), REOPEN_DELAY_MS);
      } else {
        // For example too many attempts: the user must ask for a new code.
        setError(getErrorMessage(caught));
      }
    } finally {
      setBusy(false);
    }
  };

  return {
    ...contact,
    // Typing or switching between e-mail and phone clears the messages.
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
    busy,
    error,
    accountMissing,
    codeError,
    submit,
    verifyCode,
  };
}
