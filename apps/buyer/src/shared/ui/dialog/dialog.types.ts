type DialogBaseProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  cancelLabel?: string;
  submitLabel?: string;
};

export type AlertDialogProps = DialogBaseProps & {
  onSubmit: () => void;
  destructive?: boolean;
};

export type InputDialogKeyboard = "default" | "number" | "email" | "phone";

export type InputDialogProps = DialogBaseProps & {
  onSubmit: (value: string) => void;
  placeholder?: string;
  keyboard?: InputDialogKeyboard;
  maxLength?: number;
  minLength?: number;
  oneTimeCode?: boolean;
};
