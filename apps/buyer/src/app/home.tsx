import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { ActivityIndicator, Image, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { auth } from "@/core/auth/auth";
import { useCurrentUser } from "@/core/auth/use-current-user";
import { useSession } from "@/core/auth/use-session";
import { useThemeColors } from "@/core/theme";
import { logoutDialog } from "@/modules/home/logout-dialog";
import { LoggingOutScreen } from "@/modules/home/views/logging-out-screen";
import { Button, GlassIconButton } from "@/shared/ui/button";
import { AlertDialog } from "@/shared/ui/dialog";

export default function Home() {
  const colors = useThemeColors();
  const router = useRouter();
  const session = useSession();
  const { user, loading } = useCurrentUser();
  const [logoutOpen, setLogoutOpen] = logoutDialog.useDialog();

  const signedIn = session.status === "authenticated";
  const [loggingOut, setLoggingOut] = useState(false);

  async function signOut() {
    setLoggingOut(true);
    try {
      // The short pause keeps the screen from flashing when the server answers instantly.
      await Promise.all([auth.logout(), new Promise((resolve) => setTimeout(resolve, 600))]);
    } finally {
      setLoggingOut(false);
    }
  }

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

        {signedIn ? (
          <View className="mt-8 w-full rounded-2xl border border-border bg-card p-4">
            {user ? (
              <>
                <Text className="font-sans-semibold text-base text-card-foreground">
                  {user.name}
                </Text>
                {user.email ? (
                  <Text className="mt-1 font-sans text-sm text-muted-foreground">{user.email}</Text>
                ) : null}
                {user.phone ? (
                  <Text className="mt-1 font-sans text-sm text-muted-foreground">{user.phone}</Text>
                ) : null}
              </>
            ) : loading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text className="font-sans text-sm text-muted-foreground">
                Impossible de charger votre profil.
              </Text>
            )}
          </View>
        ) : (
          <View className="mt-8 w-full rounded-2xl border border-border bg-card p-4">
            <Text className="font-sans-semibold text-base text-card-foreground">
              Paiement sécurisé
            </Text>
            <Text className="mt-1 font-sans text-sm text-muted-foreground">
              Votre argent est gardé jusqu&apos;à ce que vous confirmiez la réception avec le code
              QR.
            </Text>
          </View>
        )}

        <View className="mt-6 w-full gap-3">
          {signedIn ? (
            <Button
              label="Se déconnecter"
              variant="outline"
              size="lg"
              fullWidth
              onPress={logoutDialog.open}
            />
          ) : (
            <Button
              label="Se connecter"
              size="lg"
              fullWidth
              onPress={() => router.push("/login")}
            />
          )}
        </View>
      </View>

      <AlertDialog
        isOpen={logoutOpen}
        onOpenChange={setLogoutOpen}
        title="Se déconnecter ?"
        description="Vous devrez vous reconnecter pour accéder à votre compte."
        submitLabel="Se déconnecter"
        destructive
        onSubmit={signOut}
      />

      <LoggingOutScreen visible={loggingOut} />
    </SafeAreaView>
  );
}
