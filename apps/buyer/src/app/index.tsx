import { View } from "react-native";

import { SplashView } from "@/modules/splash/views/splash-view";
import { WelcomeView } from "@/modules/splash/views/welcome-view";
import { useLaunchState } from "@/modules/splash/hooks/use-launch-state";

export default function Index() {
  const launch = useLaunchState();

  if (launch === "loading") return <View className="flex-1 bg-background" />;

  return launch === "first" ? <WelcomeView /> : <SplashView />;
}
