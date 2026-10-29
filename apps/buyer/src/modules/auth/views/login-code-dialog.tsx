import { InputDialog } from "@/shared/ui/dialog";

import { CODE_DIALOG_CONTENT } from "../auth.content";
import type { LoginMode } from "../hooks/use-login-form";
import { loginCodeDialog } from "../login-dialogs";

type LoginCodeDialogProps = {
  mode: LoginMode;
  /** Where the code was sent: the e-mail address, or the formatted phone number. */
  target: string;
  /** Why the previous code was refused, shown above the instructions. */
  error?: string;
  onSubmit: (code: string) => void;
};

/** Asks for the 6-digit code after the e-mail or phone sign-in has been submitted. */
export function LoginCodeDialog({ mode, target, error, onSubmit }: LoginCodeDialogProps) {
  const [isOpen, setOpen] = loginCodeDialog.useDialog();

  const instructions =
    mode === "email" ? CODE_DIALOG_CONTENT.email(target) : CODE_DIALOG_CONTENT.phone(target);

  return (
    <InputDialog
      isOpen={isOpen}
      onOpenChange={setOpen}
      title={CODE_DIALOG_CONTENT.title}
      description={error ? `${error}\n\n${instructions}` : instructions}
      placeholder={CODE_DIALOG_CONTENT.placeholder}
      keyboard="number"
      maxLength={6}
      minLength={6}
      oneTimeCode
      submitLabel={CODE_DIALOG_CONTENT.submit}
      onSubmit={onSubmit}
    />
  );
}
