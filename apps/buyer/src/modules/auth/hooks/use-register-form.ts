import { useState } from "react";
import { Keyboard } from "react-native";

import { registerCodeDialog } from "../login-dialogs";
import { useContactInput } from "./use-contact-input";

const NAME_MIN_LENGTH = 2;

export function useRegisterForm() {
  const contact = useContactInput();
  const [name, setName] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  // The name needs at least 2 characters, like the server asks; the contact must be valid, and the
  // user must confirm being at least 18 (the server rejects the sign-up otherwise).
  const isValid = name.trim().length >= NAME_MIN_LENGTH && contact.isValid && ageConfirmed;

  const submit = () => {
    if (!isValid) return;
    Keyboard.dismiss();
    // Simulation: auth is not wired yet. This will call, from @swiftgoma/auth:
    //   mode "email": auth.signup.email.start({ name, email, role: "BUYER", acceptTerms: true, confirmAge: true })
    //   mode "phone": auth.signup.phone.start({ name, phone, role: "BUYER", acceptTerms: true, confirmAge: true })
    // The legal text under the form is what the user agrees to by continuing, so both flags are true.
    // Then open the code dialog once the code has been sent.
    registerCodeDialog.open();
  };

  return { ...contact, name, setName, ageConfirmed, setAgeConfirmed, isValid, submit };
}
