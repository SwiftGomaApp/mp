import { Text, View } from "react-native";
import Animated, { Easing, FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LogoReveal } from "@/shared/ui/logo-reveal";

import { ConnectionErrorView } from "../components/connection-error-view";
import { SPLASH_ANIMATION_MS } from "../constants/splash.constants";
import { useSplashRedirect } from "../hooks/use-splash-redirect";
import { SPLASH_TAGLINE } from "../splash.content";

export function SplashView() {
  const { screen, run, retry } = useSplashRedirect();

  if (screen !== "splash") {
    return <ConnectionErrorView status={screen} onRetry={retry} />;
  }
  return <SplashAnimation key={run} />;
}

function SplashAnimation() {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background">
      <View
        className="flex-1 flex-row items-center justify-center"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <LogoReveal />
      </View>

      <View className="absolute left-0 right-0" style={{ bottom: insets.bottom + 16 }}>
        <Animated.View
          entering={FadeIn.delay(0.55 * SPLASH_ANIMATION_MS)
            .duration(0.3 * SPLASH_ANIMATION_MS)
            .easing(Easing.out(Easing.quad))}
        >
          <Text className="text-center font-sans text-[12px] text-muted-foreground">
            {SPLASH_TAGLINE}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}
