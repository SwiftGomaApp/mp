import { SymbolView } from "expo-symbols";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { useThemeColors } from "@/core/theme";

type CheckboxProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** The text next to the box. Pressing it toggles the box too. */
  children: ReactNode;
};

/** A rounded check box with its label. */
export function Checkbox({ checked, onCheckedChange, children }: CheckboxProps) {
  const colors = useThemeColors();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onCheckedChange(!checked)}
      hitSlop={6}
      className="flex-row items-center gap-3 active:opacity-70"
    >
      <View
        className={`h-6 w-6 items-center justify-center rounded-md border ${
          checked ? "border-primary bg-primary" : "border-input bg-background"
        }`}
      >
        {checked ? (
          <SymbolView
            name={{ ios: "checkmark", android: "check", web: "check" }}
            size={14}
            tintColor={colors.primaryForeground}
          />
        ) : null}
      </View>

      <View className="flex-1">{children}</View>
    </Pressable>
  );
}
