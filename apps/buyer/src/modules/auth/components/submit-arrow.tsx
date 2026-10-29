import { SymbolView } from "expo-symbols";
import { ActivityIndicator, Pressable } from "react-native";

import { useThemeColors } from "@/core/theme";

import { LOGIN_CONTENT } from "../auth.content";

type SubmitArrowProps = {
  onPress: () => void;
  /** Shows a spinner instead of the arrow while a request is running. */
  loading?: boolean;
};

/** The round arrow shown at the end of a field once its entry is valid. */
export function SubmitArrow({ onPress, loading = false }: SubmitArrowProps) {
  const colors = useThemeColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={LOGIN_CONTENT.continue}
      accessibilityState={{ busy: loading }}
      disabled={loading}
      onPress={onPress}
      className="h-11 w-11 items-center justify-center rounded-full bg-primary active:opacity-80"
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.primaryForeground} />
      ) : (
        <SymbolView
          name={{ ios: "arrow.right", android: "arrow_forward", web: "arrow_forward" }}
          size={22}
          tintColor={colors.primaryForeground}
        />
      )}
    </Pressable>
  );
}
