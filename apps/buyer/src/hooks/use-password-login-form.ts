import { EMAIL_RE } from "@/modules/auth/auth.constants";
import { useState } from "react";

export function usePasswordLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const canSubmit = EMAIL_RE.test(email.trim()) && password.length > 0;

  const submit = () => {
    if (!canSubmit) return;
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
