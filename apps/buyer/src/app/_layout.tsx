import { Stack } from "expo-router";
import "../../global.css";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { useColorScheme } from "react-native";
import { appFonts } from "@/core/theme";
import { useEffect } from "react";
import { startSession } from "@/core/auth/start-session";
import { useSession } from "@/core/auth/use-session";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(appFonts);
  const colorScheme = useColorScheme();
  const ready = fontsLoaded || !!fontError;
  const isSignedIn = useSession().status === "authenticated";

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  useEffect(() => {
    startSession().catch((error) => {
      console.warn("[auth] the saved session could not be loaded", error);
    });
  }, []);

  if (!ready) return null;

  return (
    <>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="home" options={{ gestureEnabled: false }} />

        {/* Only for people who are not signed in: when a login succeeds, the router leaves these
            screens by itself and goes to the home screen. */}
        <Stack.Protected guard={!isSignedIn} redirectTo="/home">
          <Stack.Screen name="login" />
          <Stack.Screen name="create-account" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
