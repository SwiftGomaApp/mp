import { Keyboard } from "react-native";

import { loginCodeDialog } from "../login-dialogs";
import { useContactInput, type ContactMode } from "./use-contact-input";

export type LoginMode = ContactMode;

export function useLoginForm() {
  const contact = useContactInput();

  const submit = () => {
    if (!contact.isValid) return;
    Keyboard.dismiss();
    // Simulation: auth is not wired yet. This will call, from @swiftgoma/auth:
    //   mode "email": auth.login.emailCode.request({ email: contact.email.trim() })
    //   mode "phone": auth.login.phoneCode.request({ phone: contact.countryCode + contact.phone })
    // and open the code dialog once the code has been sent.
    loginCodeDialog.open();
  };

  return { ...contact, submit };
}
