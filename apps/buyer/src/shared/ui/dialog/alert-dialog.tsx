import { Alert, Button, Host, Spacer, Text } from "@expo/ui/swift-ui";
import { useColorScheme } from "nativewind";

import { DEFAULT_CANCEL_LABEL, DEFAULT_SUBMIT_LABEL } from "./dialog.constants";
import type { AlertDialogProps } from "./dialog.types";

export function AlertDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  cancelLabel = DEFAULT_CANCEL_LABEL,
  submitLabel = DEFAULT_SUBMIT_LABEL,
  destructive = false,
  onSubmit,
}: AlertDialogProps) {
  const { colorScheme } = useColorScheme();

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
          <Button label={cancelLabel} role="cancel" />
          <Button
            label={submitLabel}
            role={destructive ? "destructive" : "default"}
            onPress={onSubmit}
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
