import { Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Index() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-6">
        <Image
          source={require("../../assets/images/logo.png")}
          className="h-24 w-24"
          resizeMode="contain"
        />

        <Text className="mt-6 font-geist-extrabold text-3xl text-foreground">
          Bienvenue sur <Text className="text-primary">SwiftGoma</Text>
        </Text>

        <Text className="mt-2 text-center font-geist text-base text-muted-foreground">
          Les boutiques de Goma, livrées chez vous.
        </Text>

        <View className="mt-8 w-full rounded-2xl border border-border bg-card p-4">
          <Text className="font-geist-semibold text-base text-card-foreground">
            Paiement sécurisé
          </Text>
          <Text className="mt-1 font-geist text-sm text-muted-foreground">
            Votre argent est gardé jusqu'à ce que vous confirmiez la réception avec le code QR.
          </Text>
        </View>

        <Pressable className="mt-6 w-full items-center rounded-xl bg-primary py-4 active:opacity-80">
          <Text className="font-geist-semibold text-base text-primary-foreground">Commencer</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
