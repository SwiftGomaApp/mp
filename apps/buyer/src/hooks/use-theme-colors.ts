import { darkColors, lightColors, type ThemeColors } from "../core/theme/colors";
import { useColorScheme } from "nativewind";

export function useThemeColors(): ThemeColors {
  const { colorScheme } = useColorScheme();
  return colorScheme === "dark" ? darkColors : lightColors;
}
