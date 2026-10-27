import { Image as ExpoImage } from "expo-image";
import { SymbolView } from "expo-symbols";
import { Platform, View } from "react-native";

import { useThemeColors } from "@/core/theme";
import { Button } from "@/shared/ui/button";

import { LOGIN_CONTENT } from "../auth.content";

type SocialButtonsProps = {
  /** Shows "Continuer avec une clé d'accès" between Google and Apple. Only the sign-in has it. */
  showPasskey?: boolean;
};

/** Google, passkey (optional) and Apple (iPhone only), one above the other. */
export function SocialButtons({ showPasskey = false }: SocialButtonsProps) {
  const colors = useThemeColors();

  return (
    <View className="gap-3">
      <Button
        label={LOGIN_CONTENT.google}
        variant="outline"
        size="lg"
        fullWidth
        leading={
          <ExpoImage
            source={require("@/assets/icons/google.svg")}
            contentFit="contain"
            accessible={false}
            style={{ width: 20, height: 20 }}
          />
        }
        onPress={() => {}}
      />

      {showPasskey ? (
        <Button
          label={LOGIN_CONTENT.passkey}
          variant="outline"
          size="lg"
          fullWidth
          leading={
            <SymbolView
              name={{ ios: "person.badge.key", android: "passkey", web: "passkey" }}
              size={20}
              tintColor={colors.foreground}
            />
          }
          onPress={() => {}}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <Button
          label={LOGIN_CONTENT.apple}
          variant="outline"
          size="lg"
          fullWidth
          leading={<SymbolView name="apple.logo" size={20} tintColor={colors.foreground} />}
          onPress={() => {}}
        />
      ) : null}
    </View>
  );
}
