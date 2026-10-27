import { SymbolView } from "expo-symbols";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useThemeColors } from "@/core/theme";
import { GlassIconButton } from "@/shared/ui/button";

type SheetHeaderProps = {
  icon: ReactNode;
  title: string;
  description?: string;
  onClose: () => void;
  closeLabel?: string;
};

export function SheetHeader({
  icon,
  title,
  description,
  onClose,
  closeLabel = "Fermer",
}: SheetHeaderProps) {
  const colors = useThemeColors();

  return (
    <View>
      <View className="flex-row items-center gap-3 pb-4">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-muted">{icon}</View>

        <View className="flex-1">
          <Text numberOfLines={1} className="font-sans-bold text-[22px] text-foreground">
            {title}
          </Text>
          {description ? (
            <Text numberOfLines={2} className="font-sans text-[13px] text-muted-foreground">
              {description}
            </Text>
          ) : null}
        </View>

        <GlassIconButton label={closeLabel} onPress={onClose}>
          <SymbolView
            name={{ ios: "xmark", android: "close", web: "close" }}
            size={18}
            tintColor={colors.foreground}
          />
        </GlassIconButton>
      </View>

      <View className="bg-foreground/20" style={{ height: StyleSheet.hairlineWidth }} />
    </View>
  );
}
