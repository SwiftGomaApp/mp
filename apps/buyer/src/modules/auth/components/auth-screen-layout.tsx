import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { Image, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { lightColors } from "@/core/theme";

// Deep orange at the top to bright orange behind the illustration.
const GRADIENT_COLORS = [lightColors.chart5, lightColors.chart3, lightColors.chart2] as const;
const GRADIENT_LOCATIONS = [0, 0.5, 1] as const;

// How far the illustration is moved up from the middle of its space.
const IMAGE_LIFT = 24;

// How far the form card rises over the bottom of the illustration.
const CARD_OVERLAP = 36;

type AuthScreenLayoutProps = {
  /** The content of the rounded form card. */
  children: ReactNode;
  /** Sheets and dialogs of the screen, rendered once next to the card. */
  overlays?: ReactNode;
};

/** The shared look of the sign-in and create-account screens: gradient, illustration, form card. */
export function AuthScreenLayout({ children, overlays }: AuthScreenLayoutProps) {
  const insets = useSafeAreaInsets();

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
          {children}
        </View>
      </KeyboardAvoidingView>

      {overlays}
    </View>
  );
}
