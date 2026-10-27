import { useRouter } from "expo-router";
import { Keyboard, Pressable, Text, View } from "react-native";

import { AuthScreenLayout } from "../components/auth-screen-layout";
import { ContactField } from "../components/contact-field";
import { SocialButtons } from "../components/social-buttons";
import { SubmitArrow } from "../components/submit-arrow";
import { LOGIN_CONTENT } from "../auth.content";
import { useLoginForm } from "../hooks/use-login-form";
import { passwordSheet } from "../password-sheet";
import { LoginCodeDialog } from "./login-code-dialog";
import { PasswordSheet } from "./password-sheet";

export function LoginView() {
  const router = useRouter();
  const form = useLoginForm();

  return (
    <AuthScreenLayout
      overlays={
        <>
          <PasswordSheet />
          <LoginCodeDialog mode={form.mode} target={form.target} />
        </>
      }
    >
      <Text className="font-sans-bold text-[24px] text-foreground">{LOGIN_CONTENT.title}</Text>
      <Text className="mt-1 font-sans text-[14px] text-muted-foreground">
        {LOGIN_CONTENT.subtitle}
      </Text>

      <View className="mt-5">
        <SocialButtons showPasskey />
      </View>

      <View className="my-5 flex-row items-center gap-4">
        <View className="h-px flex-1 bg-border" />
        <Text className="font-sans text-[12px] text-muted-foreground">{LOGIN_CONTENT.or}</Text>
        <View className="h-px flex-1 bg-border" />
      </View>

      <ContactField
        contact={form}
        onSubmit={form.submit}
        accessory={form.isValid ? <SubmitArrow onPress={form.submit} /> : null}
      />

      <Pressable
        hitSlop={8}
        onPress={() => {
          Keyboard.dismiss();
          passwordSheet.open();
        }}
        className="mt-3 self-start px-1 active:opacity-70"
      >
        <Text className="font-sans-medium text-[13px] text-primary">
          {LOGIN_CONTENT.usePassword}
        </Text>
      </Pressable>

      <View className="mt-6 flex-row items-center justify-center">
        <Text className="font-sans text-[13px] text-muted-foreground">
          {LOGIN_CONTENT.noAccount}{" "}
        </Text>
        <Pressable
          hitSlop={8}
          onPress={() => router.replace("/create-account")}
          className="active:opacity-70"
        >
          <Text className="font-sans-semibold text-[13px] text-primary">
            {LOGIN_CONTENT.signUp}
          </Text>
        </Pressable>
      </View>
    </AuthScreenLayout>
  );
}
