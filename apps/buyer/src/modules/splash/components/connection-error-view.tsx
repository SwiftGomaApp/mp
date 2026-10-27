import { SymbolView } from "expo-symbols";
import { Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemeColors } from "@/core/theme";
import { Button } from "@/shared/ui/button";

import { CONNECTION_ERRORS, RETRY_LABEL, type ConnectionErrorStatus } from "../splash.content";

type ConnectionErrorViewProps = {
  status: ConnectionErrorStatus;
  onRetry: () => void;
};

export function ConnectionErrorView({ status, onRetry }: ConnectionErrorViewProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { icon, title, hint } = CONNECTION_ERRORS[status];

  return (
    <Animated.View entering={FadeIn.duration(250)} style={{ flex: 1 }}>
      <View
        className="flex-1 bg-background"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          className="flex-1 items-center justify-center px-8"
        >
          <Animated.View entering={FadeInDown.duration(300)} style={{ alignItems: "center" }}>
            <View className="h-24 w-24 items-center justify-center rounded-full bg-muted">
              <SymbolView name={icon} size={44} tintColor={colors.mutedForeground} />
            </View>

            <Text className="mt-6 text-center font-sans-bold text-[20px] text-foreground">
              {title}
            </Text>
            <Text className="mt-2 text-center font-sans text-[14px] text-muted-foreground">
              {hint}
            </Text>
          </Animated.View>
        </View>

        <View className="px-6 pb-6">
          <Button label={RETRY_LABEL} size="lg" fullWidth onPress={onRetry} />
        </View>
      </View>
    </Animated.View>
  );
}
