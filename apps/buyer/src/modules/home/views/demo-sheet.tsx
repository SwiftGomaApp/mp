import { SymbolView } from "expo-symbols";
import { Text, View } from "react-native";

import { useThemeColors } from "@/core/theme";
import { Button, GlassIconButton } from "@/shared/ui/button";
import { AppSheet } from "@/shared/ui/sheet";

import { demoSheet } from "../demo-sheet";

export function DemoSheet() {
  const colors = useThemeColors();
  const [isOpen, setOpen] = demoSheet.useSheet();

  return (
    <AppSheet
      isOpen={isOpen}
      onOpenChange={setOpen}
      detents={["medium", "large"]}
      showDragIndicator
    >
      <View className="flex-1 px-6 pt-6">
        <View className="flex-row items-center gap-3 pb-4">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-muted">
            <SymbolView
              name={{ ios: "sparkles", android: "auto_awesome", web: "auto_awesome" }}
              size={22}
              tintColor={colors.foreground}
            />
          </View>

          <View className="flex-1">
            <Text numberOfLines={1} className="font-sans-bold text-[22px] text-foreground">
              Feuille de démonstration
            </Text>
            <Text numberOfLines={2} className="font-sans text-[13px] text-muted-foreground">
              Un exemple de feuille réutilisable
            </Text>
          </View>

          <GlassIconButton label="Fermer" onPress={demoSheet.close}>
            <SymbolView
              name={{ ios: "xmark", android: "close", web: "close" }}
              size={18}
              tintColor={colors.foreground}
            />
          </GlassIconButton>
        </View>

        <View className="h-px bg-border" />

        <View className="flex-1 justify-center gap-2 pb-4">
          <Text className="text-center font-sans-bold text-[18px] text-foreground">
            Ceci est une feuille
          </Text>
          <Text className="text-center font-sans text-[14px] text-muted-foreground">
            Faites-la glisser vers le bas, touchez à côté ou utilisez le bouton pour la fermer.
          </Text>

          <View className="w-full pt-4">
            <Button
              label="Fermer"
              variant="outline"
              size="lg"
              fullWidth
              onPress={demoSheet.close}
            />
          </View>
        </View>
      </View>
    </AppSheet>
  );
}
