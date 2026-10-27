import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { useThemeColors } from "@/core/theme";

export type GlassIconButtonProps = {
  label: string;
  onPress: () => void;
  children: ReactNode;
  size?: number;
  tint?: string;
};

export function GlassIconButton({
  label,
  onPress,
  children,
  size = 44,
  tint,
}: GlassIconButtonProps) {
  const colors = useThemeColors();
  const circle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

  const hasGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6}>
      {hasGlass ? (
        <GlassView glassEffectStyle="regular" tintColor={tint} isInteractive style={circle}>
          {children}
        </GlassView>
      ) : (
        <View style={{ ...circle, backgroundColor: tint ?? colors.muted }}>{children}</View>
      )}
    </Pressable>
  );
}
