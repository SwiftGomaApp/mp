import { InputDialog } from "@/shared/ui/dialog";

import { CODE_DIALOG_CONTENT } from "../auth.content";
import type { ContactMode } from "../hooks/use-contact-input";
import { registerCodeDialog } from "../login-dialogs";

type RegisterCodeDialogProps = {
  mode: ContactMode;
  target: string;
  error?: string;
  onSubmit: (code: string) => void;
};

export function RegisterCodeDialog({ mode, target, error, onSubmit }: RegisterCodeDialogProps) {
  const [isOpen, setOpen] = registerCodeDialog.useDialog();

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
