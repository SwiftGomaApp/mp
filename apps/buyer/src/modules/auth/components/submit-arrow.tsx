import { SymbolView } from "expo-symbols";
import { Pressable } from "react-native";

import { useThemeColors } from "@/core/theme";

import { LOGIN_CONTENT } from "../auth.content";

type SubmitArrowProps = {
  onPress: () => void;
};

/** The round arrow shown at the end of a field once its entry is valid. */
export function SubmitArrow({ onPress }: SubmitArrowProps) {
  const colors = useThemeColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={LOGIN_CONTENT.continue}
      onPress={onPress}
      className="h-11 w-11 items-center justify-center rounded-full bg-primary active:opacity-80"
    >
      <SymbolView
        name={{ ios: "arrow.right", android: "arrow_forward", web: "arrow_forward" }}
        size={22}
        tintColor={colors.primaryForeground}
      />
    </Pressable>
  );
}
