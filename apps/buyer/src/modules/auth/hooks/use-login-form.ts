import { useState } from "react";

import { COUNTRY_CODE, LOCAL_PHONE_LENGTH, toLocalDigits } from "@/shared/utils/phone";

import { EMAIL_RE } from "../auth.constants";

export type LoginMode = "email" | "phone";

export function useLoginForm() {
  const [mode, setMode] = useState<LoginMode>("email");
  const [email, setEmail] = useState("");
  const [localPhone, setLocalPhone] = useState("");

  const isValid =
    mode === "phone" ? localPhone.length === LOCAL_PHONE_LENGTH : EMAIL_RE.test(email.trim());

  const switchMode = () => setMode((current) => (current === "email" ? "phone" : "email"));

  const submit = () => {
    if (!isValid) return;
    // Auth is not wired yet. This will call, from @swiftgoma/auth:
    //   mode "email": auth.login.emailCode.request({ email: email.trim() })
    //   mode "phone": auth.login.phoneCode.request({ phone: COUNTRY_CODE + localPhone })
    // then show the code entry step.
  };

  return {
    mode,
    switchMode,
    email,
    setEmail,
    phone: localPhone,
    setPhone: (raw: string) => setLocalPhone(toLocalDigits(raw)),
    countryCode: COUNTRY_CODE,
    isValid,
    submit,
  };
}
