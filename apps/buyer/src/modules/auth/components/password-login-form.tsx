import { SymbolView } from "expo-symbols";
import { useRef } from "react";
import { Pressable, Text, View, type TextInputInstance } from "react-native";

import { useThemeColors } from "@/core/theme";
import { Button } from "@/shared/ui/button";

import { PASSWORD_CONTENT } from "../auth.content";
import type { usePasswordLoginForm } from "../hooks/use-password-login-form";
import { AuthField } from "./auth-field";

type PasswordLoginFormProps = {
  form: ReturnType<typeof usePasswordLoginForm>;
  onForgotPassword: () => void;
};

export function PasswordLoginForm({ form, onForgotPassword }: PasswordLoginFormProps) {
  const colors = useThemeColors();
  const passwordRef = useRef<TextInputInstance>(null);

  return (
    <View className="gap-4 pt-5">
      <AuthField
        icon={{ ios: "envelope", android: "mail" }}
        placeholder={PASSWORD_CONTENT.emailPlaceholder}
        value={form.email}
        onChangeText={form.setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />

      <AuthField
        ref={passwordRef}
        icon={{ ios: "lock", android: "lock" }}
        placeholder={PASSWORD_CONTENT.passwordPlaceholder}
        value={form.password}
        onChangeText={form.setPassword}
        secureTextEntry={!form.showPassword}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={form.submit}
        accessory={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              form.showPassword ? PASSWORD_CONTENT.hidePassword : PASSWORD_CONTENT.showPassword
            }
            onPress={form.toggleShowPassword}
            className="h-11 w-11 items-center justify-center rounded-full active:opacity-70"
          >
            <SymbolView
              name={
                form.showPassword
                  ? { ios: "eye.slash", android: "visibility_off", web: "visibility_off" }
                  : { ios: "eye", android: "visibility", web: "visibility" }
              }
              size={20}
              tintColor={colors.mutedForeground}
            />
          </Pressable>
        }
      />

      <Pressable hitSlop={8} onPress={onForgotPassword} className="self-end px-1 active:opacity-70">
        <Text className="font-sans-medium text-[13px] text-primary">
          {PASSWORD_CONTENT.forgotPassword}
        </Text>
      </Pressable>

      <Button
        label={PASSWORD_CONTENT.submit}
        size="lg"
        fullWidth
        disabled={!form.canSubmit}
        onPress={form.submit}
      />
    </View>
  );
}
