import { useState } from "react";

import { COUNTRY_CODE, LOCAL_PHONE_LENGTH, formatPhone, toLocalDigits } from "@/shared/utils/phone";

import { EMAIL_RE } from "../auth.constants";

export type ContactMode = "email" | "phone";

/** The e-mail or phone number a code is sent to: the state shared by sign-in and create-account. */
export function useContactInput() {
  const [mode, setMode] = useState<ContactMode>("email");
  const [email, setEmail] = useState("");
  const [localPhone, setLocalPhone] = useState("");

  const isValid =
    mode === "phone" ? localPhone.length === LOCAL_PHONE_LENGTH : EMAIL_RE.test(email.trim());

  return {
    mode,
    switchMode: () => setMode((current) => (current === "email" ? "phone" : "email")),
    email,
    // A plain function (not React's setter type), so screens can wrap it with their own.
    setEmail: (value: string) => setEmail(value),
    phone: localPhone,
    setPhone: (raw: string) => setLocalPhone(toLocalDigits(raw)),
    countryCode: COUNTRY_CODE,
    isValid,
    /** Where the code goes, as shown to the user: the e-mail address or the formatted number. */
    target: mode === "email" ? email.trim() : formatPhone(localPhone),
  };
}

export type ContactInput = ReturnType<typeof useContactInput>;
