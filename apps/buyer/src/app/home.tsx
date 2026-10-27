import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Image, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useThemeColors } from "@/core/theme";
import { codeDialog, confirmDialog } from "@/modules/home/demo-dialogs";
import { demoSheet } from "@/modules/home/demo-sheet";
import { DemoDialogs } from "@/modules/home/views/demo-dialogs";
import { DemoSheet } from "@/modules/home/views/demo-sheet";
import { Button, GlassIconButton } from "@/shared/ui/button";

export default function Home() {
  const colors = useThemeColors();
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-6">
        <Image
          source={require("../../assets/images/logo.png")}
          className="h-24 w-24"
          resizeMode="contain"
        />

        <Text className="mt-6 font-sans-extrabold text-3xl text-foreground">
          Bienvenue sur <Text className="text-primary">SwiftGoma</Text>
        </Text>

        <Text className="mt-2 text-center font-sans text-base text-muted-foreground">
          Les boutiques de Goma, livrées chez vous.
        </Text>

        <View className="mt-6 flex-row items-center gap-4">
          <GlassIconButton label="Notifications" onPress={() => {}}>
            <SymbolView
              name={{ ios: "bell", android: "notifications", web: "notifications" }}
              size={20}
              tintColor={colors.foreground}
            />
          </GlassIconButton>

          <GlassIconButton label="Ajouter" tint={colors.primary} onPress={() => {}}>
            <SymbolView
              name={{ ios: "plus", android: "add", web: "add" }}
              size={20}
              tintColor={colors.primaryForeground}
            />
          </GlassIconButton>
        </View>

        <View className="mt-8 w-full rounded-2xl border border-border bg-card p-4">
          <Text className="font-sans-semibold text-base text-card-foreground">
            Paiement sécurisé
          </Text>
          <Text className="mt-1 font-sans text-sm text-muted-foreground">
            Votre argent est gardé jusqu&apos;à ce que vous confirmiez la réception avec le code QR.
          </Text>
        </View>

        <View className="mt-6 w-full gap-3">
          <Button label="Se connecter" size="lg" fullWidth onPress={() => router.push("/login")} />
          <Button
            label="Ouvrir la feuille (démo)"
            variant="outline"
            size="lg"
            fullWidth
            onPress={demoSheet.open}
          />
          <Button
            label="Alerte (démo)"
            variant="outline"
            size="lg"
            fullWidth
            onPress={confirmDialog.open}
          />
          <Button
            label="Code (démo)"
            variant="outline"
            size="lg"
            fullWidth
            onPress={codeDialog.open}
          />
        </View>
      </View>

      <DemoSheet />
      <DemoDialogs />
    </SafeAreaView>
  );
}
