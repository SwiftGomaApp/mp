import { Host, ProgressView, Button as SwiftButton, Text } from "@expo/ui/swift-ui";
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  frame,
  labelStyle,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useColorScheme } from "nativewind";
import { Platform } from "react-native";

import { useThemeColors } from "@/core/theme";

import { PressableButton } from "./button.pressable";
import { accentColor, contentColor } from "./button.styles";
import { ButtonProps, ButtonSize } from "../../../../types";

const controlSizes = {
  lg: "large",
  md: "regular",
  sm: "small",
} as const satisfies Record<ButtonSize, "large" | "regular" | "small">;

const supportsGlass = Number.parseInt(String(Platform.Version), 10) >= 26;

export function Button(props: ButtonProps) {
  // The native SwiftUI button cannot show a custom logo (Google's, for example), so a label button
  // with a `leading` element is drawn with the React Native version instead.
  if (props.variant !== "icon" && props.leading) return <PressableButton {...props} />;
  return <NativeButton {...props} />;
}

function NativeButton(props: ButtonProps) {
  const { size = "md", disabled = false, onPress, style } = props;
  const colors = useThemeColors();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const hostScheme = isDark ? "dark" : "light";

  const common = () => [controlSize(controlSizes[size]), disabledModifier(disabled)];

  if (props.variant === "icon") {
    const accent = colors.secondaryForeground;

    return (
      <Host
        matchContents
        colorScheme={hostScheme}
        seedColor={accent}
        style={[{ alignSelf: "flex-start" }, style]}
      >
        <SwiftButton
          label={props.accessibilityLabel}
          systemImage={props.icon.ios}
          onPress={onPress}
          modifiers={[
            buttonStyle(supportsGlass ? "glass" : "bordered"),
            buttonBorderShape("circle"),
            labelStyle("iconOnly"),
            tint(accent),
            ...common(),
          ]}
        />
      </Host>
    );
  }

  const { label, variant = "default", fullWidth = false, loading = false } = props;
  const accent = accentColor(variant, colors);

  const style_ =
    variant === "outline"
      ? supportsGlass
        ? "glass"
        : "bordered"
      : supportsGlass
        ? "glassProminent"
        : "borderedProminent";

  const modifiers = [buttonStyle(style_), tint(accent), ...common()];

  const showChildren = fullWidth || loading;

  return (
    <Host
      matchContents={fullWidth ? { vertical: true } : true}
      colorScheme={hostScheme}
      seedColor={accent}
      style={[fullWidth ? { width: "100%" } : { alignSelf: "flex-start" }, style]}
    >
      {showChildren ? (
        <SwiftButton onPress={loading ? undefined : onPress} modifiers={modifiers}>
          {loading ? (
            <ProgressView
              modifiers={[
                controlSize("regular"),
                tint(contentColor(variant, colors, isDark)),
                ...(fullWidth ? [frame({ maxWidth: Infinity })] : []),
              ]}
            />
          ) : (
            <Text modifiers={[frame({ maxWidth: Infinity })]}>{label}</Text>
          )}
        </SwiftButton>
      ) : (
        <SwiftButton label={label} onPress={onPress} modifiers={modifiers} />
      )}
    </Host>
  );
}
