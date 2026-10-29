import { SymbolView } from "expo-symbols";
import type { ReactNode, Ref } from "react";
import { Text, TextInput, View, type TextInputInstance, type TextInputProps } from "react-native";

import { useThemeColors } from "@/core/theme";
import type { ButtonIcon } from "@/shared/ui/button";

type AuthFieldProps = TextInputProps & {
  /** Icon shown at the start of the field. */
  icon: ButtonIcon;
  /** Fixed text shown before what the user types, for example a country code. */
  prefix?: string;
  /** Something shown at the end of the field, for example a round action button. */
  accessory?: ReactNode;
  /** An error message shown under the field, which also turns its border red. */
  error?: string;
  ref?: Ref<TextInputInstance>;
};

// The field is 56 high with a 1 border, so a 44 round button inside it has a 5 gap above and below.
// The right padding of 4 plus the border gives the same 5 gap on the right.
const FIELD_BOX = "h-[56px] flex-row items-center rounded-full border bg-muted pl-5 pr-[4px]";
const INPUT = "h-full flex-1 font-sans text-[16px] text-foreground";

export function AuthField({ icon, prefix, accessory, error, ...props }: AuthFieldProps) {
  const colors = useThemeColors();

  return (
    <View>
      <View className={`${FIELD_BOX} ${error ? "border-destructive" : "border-border"}`}>
        <SymbolView
          name={{ ios: icon.ios, android: icon.android, web: icon.android }}
          size={20}
          tintColor={colors.mutedForeground}
        />
        {prefix ? (
          <>
            <Text className="ml-3 font-sans-medium text-[16px] text-foreground">{prefix}</Text>
            <View className="mx-3 h-6 w-px bg-border" />
          </>
        ) : null}
        <TextInput
          placeholderTextColor={colors.mutedForeground}
          className={prefix ? INPUT : `ml-3 ${INPUT}`}
          {...props}
        />
        {accessory}
      </View>
      {error ? (
        <Text className="mt-1.5 px-4 font-sans text-[12px] text-destructive">{error}</Text>
      ) : null}
    </View>
  );
}
