import { SymbolView } from "expo-symbols";
import { useState } from "react";

import { useThemeColors } from "@/core/theme";
import { ScrollSheet, SheetHeader } from "@/shared/ui/sheet";

import { ForgotPasswordForm } from "../components/forgot-password-form";
import { PasswordLoginForm } from "../components/password-login-form";
import { FORGOT_CONTENT, PASSWORD_CONTENT } from "../auth.content";
import { useForgotPasswordForm } from "../hooks/use-forgot-password-form";
import { usePasswordLoginForm } from "../hooks/use-password-login-form";
import { passwordSheet } from "../password-sheet";
import { PasswordCodeDialog } from "./password-code-dialog";

type View = "login" | "forgot";

/** One sheet with two views: the password login, and the forgot-password steps. */
export function PasswordSheet() {
  const colors = useThemeColors();
  const [isOpen, setOpen] = passwordSheet.useSheet();
  const login = usePasswordLoginForm();
  const forgot = useForgotPasswordForm();
  const [view, setView] = useState<View>("login");
  const [wasOpen, setWasOpen] = useState(isOpen);

  // Every time the sheet opens, it starts on the login view.
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setView("login");
  }

  const openForgot = () => {
    forgot.setEmail(login.email);
    setView("forgot");
  };

  const isForgot = view === "forgot";

  return (
    <ScrollSheet
      isOpen={isOpen}
      onOpenChange={setOpen}
      showDragIndicator
      keyboardShouldPersistTaps="handled"
      header={
        <SheetHeader
          icon={
            <SymbolView
              name={
                isForgot
                  ? { ios: "key", android: "key", web: "key" }
                  : { ios: "lock", android: "lock", web: "lock" }
              }
              size={22}
              tintColor={colors.foreground}
            />
          }
          title={isForgot ? FORGOT_CONTENT.title : PASSWORD_CONTENT.title}
          description={isForgot ? FORGOT_CONTENT.description : PASSWORD_CONTENT.description}
          closeLabel={PASSWORD_CONTENT.close}
          onClose={passwordSheet.close}
        />
      }
    >
      {isForgot ? (
        <ForgotPasswordForm form={forgot} onBack={() => setView("login")} />
      ) : (
        <PasswordLoginForm form={login} onForgotPassword={openForgot} />
      )}

      {/* Inside the sheet, so the dialog is presented over the sheet and not behind it. */}
      <PasswordCodeDialog />
    </ScrollSheet>
  );
}
