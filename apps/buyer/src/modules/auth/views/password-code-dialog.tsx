import { InputDialog } from "@/shared/ui/dialog";

import { CODE_DIALOG_CONTENT } from "../auth.content";
import { passwordCodeDialog } from "../login-dialogs";

/** Asks for the two-step code after the password sign-in has been submitted. */
export function PasswordCodeDialog() {
  const [isOpen, setOpen] = passwordCodeDialog.useDialog();

  return (
    <InputDialog
      isOpen={isOpen}
      onOpenChange={setOpen}
      title={CODE_DIALOG_CONTENT.twoStepTitle}
      description={CODE_DIALOG_CONTENT.twoStep}
      placeholder={CODE_DIALOG_CONTENT.placeholder}
      keyboard="number"
      maxLength={6}
      minLength={6}
      oneTimeCode
      submitLabel={CODE_DIALOG_CONTENT.submit}
      onSubmit={() => {
        // Simulation: this will call auth.twoFactor.verify({ code }) from @swiftgoma/auth.
      }}
    />
  );
}
