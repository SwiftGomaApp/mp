import { Alert, Button, Host, Spacer, Text, TextField, useNativeState } from "@expo/ui/swift-ui";
import {
  autocorrectionDisabled,
  disabled as disabledModifier,
  keyboardType,
  textContentType,
  textInputAutocapitalization,
} from "@expo/ui/swift-ui/modifiers";
import { useColorScheme } from "nativewind";
import { useEffect, useState } from "react";

import { DEFAULT_CANCEL_LABEL, DEFAULT_SUBMIT_LABEL } from "./dialog.constants";
import type { InputDialogKeyboard, InputDialogProps } from "./dialog.types";

const KEYBOARDS = {
  default: "default",
  number: "numeric",
  email: "email-address",
  phone: "phone-pad",
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
  oneTimeCode = false,
  cancelLabel = DEFAULT_CANCEL_LABEL,
  submitLabel = DEFAULT_SUBMIT_LABEL,
  onSubmit,
}: InputDialogProps) {
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

  return (
    <Host
      colorScheme={colorScheme === "dark" ? "dark" : "light"}
      style={{ position: "absolute", width: 0, height: 0 }}
    >
      <Alert title={title} isPresented={isOpen} onIsPresentedChange={onOpenChange}>
        <Alert.Trigger>
          <Spacer />
        </Alert.Trigger>

        <Alert.Actions>
          <TextField
            text={text}
            placeholder={placeholder}
            maxLength={maxLength}
            autoFocus
            onTextChange={setValue}
            modifiers={[
              keyboardType(KEYBOARDS[keyboard]),
              autocorrectionDisabled(),
              textInputAutocapitalization("never"),
              ...(oneTimeCode ? [textContentType("oneTimeCode")] : []),
            ]}
          />
          <Button label={cancelLabel} role="cancel" />
          <Button
            label={submitLabel}
            modifiers={[disabledModifier(value.length < minLength)]}
            onPress={() => onSubmit(value)}
          />
        </Alert.Actions>

        {description ? (
          <Alert.Message>
            <Text>{description}</Text>
          </Alert.Message>
        ) : null}
      </Alert>
    </Host>
  );
}
