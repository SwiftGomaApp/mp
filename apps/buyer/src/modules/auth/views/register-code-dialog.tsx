import { InputDialog } from "@/shared/ui/dialog";

import { CODE_DIALOG_CONTENT } from "../auth.content";
import type { ContactMode } from "../hooks/use-contact-input";
import { registerCodeDialog } from "../login-dialogs";

type RegisterCodeDialogProps = {
  mode: ContactMode;
  /** Where the code was sent: the e-mail address, or the formatted phone number. */
  target: string;
};

/** Asks for the 6-digit code after the create-account form has been submitted. */
export function RegisterCodeDialog({ mode, target }: RegisterCodeDialogProps) {
  const [isOpen, setOpen] = registerCodeDialog.useDialog();

  return (
    <InputDialog
      isOpen={isOpen}
      onOpenChange={setOpen}
      title={CODE_DIALOG_CONTENT.title}
      description={
        mode === "email" ? CODE_DIALOG_CONTENT.email(target) : CODE_DIALOG_CONTENT.phone(target)
      }
      placeholder={CODE_DIALOG_CONTENT.placeholder}
      keyboard="number"
      maxLength={6}
      minLength={6}
      oneTimeCode
      submitLabel={CODE_DIALOG_CONTENT.submit}
      onSubmit={() => {
        // Simulation: this will call auth.signup.email.verify or auth.signup.phone.verify from
        // @swiftgoma/auth with the code, which opens the session.
      }}
    />
  );
}
