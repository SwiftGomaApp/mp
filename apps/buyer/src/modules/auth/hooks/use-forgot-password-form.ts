import { useState } from "react";

import { EMAIL_RE } from "../auth.constants";

export function useForgotPasswordForm() {
  const [email, setEmail] = useState("");

  const isValid = EMAIL_RE.test(email.trim());

  const submit = () => {
    if (!isValid) return;
    // Auth is not wired yet. This will call POST /auth/password/forgot with { email: email.trim() },
    // then show the code entry step. The server always answers with the same message, whether the
    // account exists or not, so the next step must not depend on the answer.
  };

  return { email, setEmail, isValid, submit };
}
