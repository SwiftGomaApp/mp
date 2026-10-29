import {
  AlertDialog as ComposeAlertDialog,
  Host,
  Text,
  TextButton,
} from "@expo/ui/jetpack-compose";
import { useColorScheme } from "nativewind";

import { useThemeColors } from "@/core/theme";

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
  const colors = useThemeColors();
  const { colorScheme } = useColorScheme();

  const close = () => onOpenChange(false);

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

          {description ? (
            <ComposeAlertDialog.Text>
              <Text>{description}</Text>
            </ComposeAlertDialog.Text>
          ) : null}

          <ComposeAlertDialog.ConfirmButton>
            <TextButton
              colors={{ contentColor: destructive ? colors.destructive : colors.primary }}
              onClick={() => {
                close();
                onSubmit();
              }}
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
