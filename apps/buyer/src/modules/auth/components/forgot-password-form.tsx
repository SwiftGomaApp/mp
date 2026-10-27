import { Pressable, Text, View } from "react-native";

import { Button } from "@/shared/ui/button";

import { FORGOT_CONTENT } from "../auth.content";
import type { useForgotPasswordForm } from "../hooks/use-forgot-password-form";
import { AuthField } from "./auth-field";

type ForgotPasswordFormProps = {
  form: ReturnType<typeof useForgotPasswordForm>;
  onBack: () => void;
};

/** Step 1 of the password reset: the e-mail address that will receive the code. */
export function ForgotPasswordForm({ form, onBack }: ForgotPasswordFormProps) {
  return (
    <View className="gap-4 pt-5">
      <AuthField
        icon={{ ios: "envelope", android: "mail" }}
        placeholder={FORGOT_CONTENT.emailPlaceholder}
        value={form.email}
        onChangeText={form.setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="go"
        onSubmitEditing={form.submit}
      />

      <Button
        label={FORGOT_CONTENT.send}
        size="lg"
        fullWidth
        disabled={!form.isValid}
        onPress={form.submit}
      />

      <Pressable hitSlop={8} onPress={onBack} className="self-center px-1 active:opacity-70">
        <Text className="font-sans-medium text-[13px] text-primary">{FORGOT_CONTENT.back}</Text>
      </Pressable>
    </View>
  );
}
