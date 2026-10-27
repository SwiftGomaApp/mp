import { InputDialog } from "@/shared/ui/dialog";

import { CODE_DIALOG_CONTENT } from "../auth.content";
import { loginCodeDialog } from "../login-dialogs";
import type { LoginMode } from "../hooks/use-login-form";

type LoginCodeDialogProps = {
  mode: LoginMode;
  /** Where the code was sent: the e-mail address, or the formatted phone number. */
  target: string;
};

/** Asks for the 6-digit code after the e-mail or phone sign-in has been submitted. */
export function LoginCodeDialog({ mode, target }: LoginCodeDialogProps) {
  const [isOpen, setOpen] = loginCodeDialog.useDialog();

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
        // Simulation: this will call auth.login.emailCode.verify or auth.login.phoneCode.verify
        // from @swiftgoma/auth with the code, then handle the login result.
      }}
    />
  );
}
