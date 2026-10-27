import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "expo-symbols";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { lightColors, useThemeColors } from "@/core/theme";
import { Button } from "@/shared/ui/button";

import { AuthField } from "../components/auth-field";
import { LOGIN_CONTENT } from "../auth.content";
import { useLoginForm } from "../hooks/use-login-form";

// Deep orange at the top to bright orange behind the illustration.
const GRADIENT_COLORS = [lightColors.chart5, lightColors.chart3, lightColors.chart2] as const;
const GRADIENT_LOCATIONS = [0, 0.5, 1] as const;

// How far the illustration is moved up from the middle of its space.
const IMAGE_LIFT = 24;

// How far the form card rises over the bottom of the illustration.
const CARD_OVERLAP = 36;

export function LoginView() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const form = useLoginForm();

  // The round arrow appears only once the e-mail address or the phone number is valid.
  const submitArrow = form.isValid ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={LOGIN_CONTENT.continue}
      onPress={form.submit}
      className="h-11 w-11 items-center justify-center rounded-full bg-primary active:opacity-80"
    >
      <SymbolView
        name={{ ios: "arrow.right", android: "arrow_forward", web: "arrow_forward" }}
        size={22}
        tintColor={colors.primaryForeground}
      />
    </Pressable>
  ) : null;

  return (
    <View className="flex-1 bg-background">
      <StatusBar style="light" />

      <LinearGradient
        colors={GRADIENT_COLORS}
        locations={GRADIENT_LOCATIONS}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View
          className="min-h-0 flex-1 px-8 pb-3"
          style={{ zIndex: 1, paddingTop: insets.top + 16 }}
        >
          <Image
            source={require("@/assets/icons/login-image.png")}
            className="h-full w-full"
            resizeMode="contain"
            accessible={false}
            style={{ top: -IMAGE_LIFT }}
          />
        </View>

        <View
          className="rounded-t-[32px] bg-background px-6 pt-8"
          style={{ marginTop: -CARD_OVERLAP, paddingBottom: Math.max(insets.bottom, 16) + 8 }}
        >
          <Text className="font-sans-bold text-[24px] text-foreground">{LOGIN_CONTENT.title}</Text>
          <Text className="mt-1 font-sans text-[14px] text-muted-foreground">
            {LOGIN_CONTENT.subtitle}
          </Text>

          <View className="mt-5 gap-3">
            <Button
              label={LOGIN_CONTENT.google}
              variant="outline"
              size="lg"
              fullWidth
              leading={
                <ExpoImage
                  source={require("@/assets/icons/google.svg")}
                  contentFit="contain"
                  accessible={false}
                  style={{ width: 20, height: 20 }}
                />
              }
              onPress={() => {}}
            />

            {Platform.OS === "ios" ? (
              <Button
                label={LOGIN_CONTENT.apple}
                variant="outline"
                size="lg"
                fullWidth
                leading={<SymbolView name="apple.logo" size={20} tintColor={colors.foreground} />}
                onPress={() => {}}
              />
            ) : null}
          </View>

          <View className="my-5 flex-row items-center gap-4">
            <View className="h-px flex-1 bg-border" />
            <Text className="font-sans text-[12px] text-muted-foreground">{LOGIN_CONTENT.or}</Text>
            <View className="h-px flex-1 bg-border" />
          </View>

          <View className="mb-3 flex-row items-center justify-end px-1">
            <Pressable hitSlop={8} onPress={form.switchMode} className="active:opacity-70">
              <Text className="font-sans-medium text-[13px] text-primary">
                {form.mode === "email" ? LOGIN_CONTENT.usePhone : LOGIN_CONTENT.useEmail}
              </Text>
            </Pressable>
          </View>

          <View>
            {form.mode === "email" ? (
              <AuthField
                key="email"
                icon={{ ios: "envelope", android: "mail" }}
                placeholder={LOGIN_CONTENT.emailPlaceholder}
                value={form.email}
                onChangeText={form.setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                textContentType="username"
                returnKeyType="go"
                onSubmitEditing={form.submit}
                accessory={submitArrow}
              />
            ) : (
              <AuthField
                key="phone"
                icon={{ ios: "phone", android: "call" }}
                prefix={form.countryCode}
                placeholder={LOGIN_CONTENT.phonePlaceholder}
                value={form.phone}
                onChangeText={form.setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                accessory={submitArrow}
              />
            )}
          </View>

          <Pressable hitSlop={8} className="mt-3 self-start px-1 active:opacity-70">
            <Text className="font-sans-medium text-[13px] text-primary">
              {LOGIN_CONTENT.usePassword}
            </Text>
          </Pressable>

          <View className="mt-6 flex-row items-center justify-center">
            <Text className="font-sans text-[13px] text-muted-foreground">
              {LOGIN_CONTENT.noAccount}{" "}
            </Text>
            <Pressable hitSlop={8} className="active:opacity-70">
              <Text className="font-sans-semibold text-[13px] text-primary">
                {LOGIN_CONTENT.signUp}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
