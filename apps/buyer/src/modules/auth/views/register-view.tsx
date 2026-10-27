import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { Button } from "@/shared/ui/button";
import { LegalLinks } from "@/modules/legal/components/legal-links";
import { Checkbox } from "@/shared/ui/checkbox";

import { AuthField } from "../components/auth-field";
import { AuthScreenLayout } from "../components/auth-screen-layout";
import { ContactField, ContactSwitchLink } from "../components/contact-field";
import { SocialButtons } from "../components/social-buttons";
import { LOGIN_CONTENT, REGISTER_CONTENT } from "../auth.content";
import { useRegisterForm } from "../hooks/use-register-form";
import { RegisterCodeDialog } from "./register-code-dialog";

export function RegisterView() {
  const router = useRouter();
  const form = useRegisterForm();

  return (
    <AuthScreenLayout overlays={<RegisterCodeDialog mode={form.mode} target={form.target} />}>
      <Text className="font-sans-bold text-[24px] text-foreground">{REGISTER_CONTENT.title}</Text>
      <Text className="mt-1 font-sans text-[14px] text-muted-foreground">
        {REGISTER_CONTENT.subtitle}
      </Text>

      <View className="mt-5">
        <SocialButtons />
      </View>

      <View className="my-5 flex-row items-center gap-4">
        <View className="h-px flex-1 bg-border" />
        <Text className="font-sans text-[12px] text-muted-foreground">{LOGIN_CONTENT.or}</Text>
        <View className="h-px flex-1 bg-border" />
      </View>

      <AuthField
        icon={{ ios: "person", android: "person" }}
        placeholder={REGISTER_CONTENT.namePlaceholder}
        value={form.name}
        onChangeText={form.setName}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
      />

      <View className="mt-3">
        <ContactField contact={form} onSubmit={form.submit} showSwitch={false} />
      </View>

      <View className="mt-3 flex-row items-center justify-between px-1">
        <View className="flex-1 pr-3">
          <Checkbox checked={form.ageConfirmed} onCheckedChange={form.setAgeConfirmed}>
            <Text className="font-sans text-[13px] text-foreground">
              {REGISTER_CONTENT.ageConfirm}
            </Text>
          </Checkbox>
        </View>
        <ContactSwitchLink contact={form} />
      </View>

      <View className="mt-4">
        <Button
          label={REGISTER_CONTENT.submit}
          size="lg"
          fullWidth
          disabled={!form.isValid}
          onPress={form.submit}
        />
      </View>

      <View className="mt-4">
        <LegalLinks />
      </View>

      <View className="mt-5 flex-row items-center justify-center">
        <Text className="font-sans text-[13px] text-muted-foreground">
          {REGISTER_CONTENT.haveAccount}{" "}
        </Text>
        <Pressable
          hitSlop={8}
          onPress={() => router.replace("/login")}
          className="active:opacity-70"
        >
          <Text className="font-sans-semibold text-[13px] text-primary">
            {REGISTER_CONTENT.signIn}
          </Text>
        </Pressable>
      </View>
    </AuthScreenLayout>
  );
}
