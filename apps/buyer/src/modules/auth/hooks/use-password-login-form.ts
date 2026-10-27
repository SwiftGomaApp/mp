import { useState } from "react";

import { EMAIL_RE } from "../auth.constants";

export function usePasswordLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const canSubmit = EMAIL_RE.test(email.trim()) && password.length > 0;

  const submit = () => {
    if (!canSubmit) return;
    // Auth is not wired yet. This will call auth.login.password({ email: email.trim(), password })
    // from @swiftgoma/auth and handle its three results.
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    toggleShowPassword: () => setShowPassword((value) => !value),
    canSubmit,
    submit,
  };
}
