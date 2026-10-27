import {
  AlertDialog as ComposeAlertDialog,
  Column,
  Host,
  OutlinedTextField,
  Text,
  TextButton,
  useNativeState,
} from "@expo/ui/jetpack-compose";
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers";
import { useColorScheme } from "nativewind";
import { useEffect, useState } from "react";

import { useThemeColors } from "@/core/theme";

import { DEFAULT_CANCEL_LABEL, DEFAULT_SUBMIT_LABEL } from "./dialog.constants";
import type { InputDialogKeyboard, InputDialogProps } from "./dialog.types";

const KEYBOARDS = {
  default: "text",
  number: "number",
  email: "email",
  phone: "phone",
} as const satisfies Record<InputDialogKeyboard, string>;

export function InputDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  placeholder,
  keyboard = "default",
  maxLength,
  minLength = 1,
  cancelLabel = DEFAULT_CANCEL_LABEL,
  submitLabel = DEFAULT_SUBMIT_LABEL,
  onSubmit,
}: InputDialogProps) {
  const colors = useThemeColors();
  const { colorScheme } = useColorScheme();
  const text = useNativeState("");
  const [value, setValue] = useState("");
  const [wasOpen, setWasOpen] = useState(isOpen);

  // Every time the dialog opens or closes, the typed text starts over.
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    setValue("");
  }
  useEffect(() => {
    text.set("");
  }, [isOpen, text]);

  const close = () => onOpenChange(false);
  const submit = (typed: string) => {
    close();
    onSubmit(typed);
  };

  return (
    <Host
      colorScheme={colorScheme === "dark" ? "dark" : "light"}
      style={{ position: "absolute", width: 0, height: 0 }}
    >
      {isOpen ? (
        <ComposeAlertDialog
          onDismissRequest={close}
          colors={{
            containerColor: colors.card,
            titleContentColor: colors.foreground,
            textContentColor: colors.mutedForeground,
          }}
        >
          <ComposeAlertDialog.Title>
            <Text>{title}</Text>
          </ComposeAlertDialog.Title>

          <ComposeAlertDialog.Text>
            <Column verticalArrangement={{ spacedBy: 12 }}>
              {description ? <Text>{description}</Text> : null}
              <OutlinedTextField
                value={text}
                onValueChange={setValue}
                singleLine
                autoFocus
                maxLength={maxLength}
                keyboardOptions={{ keyboardType: KEYBOARDS[keyboard], imeAction: "done" }}
                keyboardActions={{
                  onDone: (typed) => {
                    if (typed.length >= minLength) submit(typed);
                  },
                }}
                modifiers={[fillMaxWidth()]}
              >
                {placeholder ? (
                  <OutlinedTextField.Placeholder>
                    <Text>{placeholder}</Text>
                  </OutlinedTextField.Placeholder>
                ) : null}
              </OutlinedTextField>
            </Column>
          </ComposeAlertDialog.Text>

          <ComposeAlertDialog.ConfirmButton>
            <TextButton
              enabled={value.length >= minLength}
              colors={{ contentColor: colors.primary }}
              onClick={() => submit(value)}
            >
              <Text>{submitLabel}</Text>
            </TextButton>
          </ComposeAlertDialog.ConfirmButton>

          <ComposeAlertDialog.DismissButton>
            <TextButton colors={{ contentColor: colors.foreground }} onClick={close}>
              <Text>{cancelLabel}</Text>
            </TextButton>
          </ComposeAlertDialog.DismissButton>
        </ComposeAlertDialog>
      ) : null}
    </Host>
  );
}
