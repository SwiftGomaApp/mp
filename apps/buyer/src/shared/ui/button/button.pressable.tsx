import { SymbolView } from "expo-symbols";
import { useColorScheme } from "nativewind";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { useThemeColors } from "@/core/theme";

import { contentColor, sizeStyles, variantStyles } from "./button.styles";
import { ButtonProps } from "../../../../types";

/**
 * The button drawn with React Native views. It is the button on Android and the web, and on iOS
 * for a label button with a `leading` element (a logo), which the native SwiftUI button cannot show.
 */
export function PressableButton(props: ButtonProps) {
  const { size = "md", disabled = false, onPress, style } = props;
  const colors = useThemeColors();
  const { colorScheme } = useColorScheme();
  const s = sizeStyles[size];

  if (props.variant === "icon") {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel}
        accessibilityState={{ disabled }}
        disabled={disabled}
        hitSlop={s.hitSlop}
        onPress={onPress}
        className={`items-center justify-center self-start rounded-full bg-secondary active:bg-secondary/80 ${s.icon} ${disabled ? "opacity-50" : ""}`}
        style={style}
      >
        <SymbolView
          name={{
            ios: props.icon.ios,
            android: props.icon.android,
            web: props.icon.android,
          }}
          size={s.iconSize}
          tintColor={colors.secondaryForeground}
        />
      </Pressable>
    );
  }

  const { label, variant = "default", fullWidth = false, loading = false, leading } = props;
  const v = variantStyles[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      hitSlop={s.hitSlop}
      onPress={onPress}
      className={`flex-row items-center justify-center rounded-full ${s.box} ${v.box} ${fullWidth ? "w-full" : "self-start"} ${disabled ? "opacity-50" : ""}`}
      style={style}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={contentColor(variant, colors, colorScheme === "dark")}
        />
      ) : (
        <>
          {leading ? <View className="mr-2.5">{leading}</View> : null}
          <Text numberOfLines={1} className={`font-sans-semibold ${s.text} ${v.text}`}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
