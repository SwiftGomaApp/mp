import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemeColors } from "@/core/theme";
import { Button } from "@/shared/ui/button";
import { LOGO_REVEAL_MS, LogoReveal } from "@/shared/ui/logo-reveal";

import { markOnboardingSeen } from "../storage/onboarding-storage";
import { WELCOME_CONTENT } from "../splash.content";

// A soft orange glow at the top that melts into the theme background (white or dark), so the
// screen stays mostly background-colored. The last stop is the background itself.
const GLOW = {
  light: ["rgba(255, 105, 0, 0.32)", "rgba(255, 184, 106, 0.16)"],
  dark: ["rgba(255, 79, 0, 0.5)", "rgba(255, 79, 0, 0.14)"],
} as const;
const GLOW_LOCATIONS = [0, 0.32, 0.68] as const;

// Each element fades in after the logo animation, one after the other.
const TITLE_DELAY_MS = LOGO_REVEAL_MS + 100;
const DESCRIPTION_DELAY_MS = TITLE_DELAY_MS + 450;
const BUTTON_DELAY_MS = DESCRIPTION_DELAY_MS + 450;
const FADE_MS = 700;

const fadeIn = (delay: number) =>
  FadeInDown.delay(delay).duration(FADE_MS).easing(Easing.out(Easing.cubic));

export function WelcomeView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { colorScheme } = useColorScheme();
  const glow = GLOW[colorScheme === "dark" ? "dark" : "light"];
  const [buttonReady, setButtonReady] = useState(false);

  // The button is invisible until it fades in, so it must not be tappable before then.
  useEffect(() => {
    const timer = setTimeout(() => setButtonReady(true), BUTTON_DELAY_MS + FADE_MS);
    return () => clearTimeout(timer);
  }, []);

  const start = async () => {
    await markOnboardingSeen();
    router.replace("/home");
  };

  return (
    <View className="flex-1 bg-background">
      <LinearGradient
        colors={[glow[0], glow[1], colors.background]}
        locations={GLOW_LOCATIONS}
        style={StyleSheet.absoluteFill}
      />

      <View
        className="flex-1 flex-row items-center justify-center"
        style={{ paddingTop: insets.top }}
      >
        <LogoReveal scale={1.4} />
      </View>

      <View className="px-6" style={{ paddingBottom: insets.bottom + 16 }}>
        <Animated.View entering={fadeIn(TITLE_DELAY_MS)}>
          <Text className="font-sans-extrabold text-[34px] leading-[38px] tracking-[-0.5px] text-foreground">
            {WELCOME_CONTENT.title}
          </Text>
        </Animated.View>

        <Animated.View entering={fadeIn(DESCRIPTION_DELAY_MS)}>
          <Text className="mt-3 font-sans text-base text-muted-foreground">
            {WELCOME_CONTENT.description}
          </Text>
        </Animated.View>

        <Animated.View
          entering={fadeIn(BUTTON_DELAY_MS)}
          className="mt-8"
          pointerEvents={buttonReady ? "auto" : "none"}
        >
          <Button label={WELCOME_CONTENT.start} size="lg" fullWidth onPress={start} />
        </Animated.View>
      </View>
    </View>
  );
}
