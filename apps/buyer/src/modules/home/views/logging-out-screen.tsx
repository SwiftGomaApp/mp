import { ActivityIndicator, Modal, Text, View } from "react-native";

import { useThemeColors } from "@/core/theme";

type LoggingOutScreenProps = {
  visible: boolean;
};

/** A full-screen cover with a spinner, shown while the user is being signed out. */
export function LoggingOutScreen({ visible }: LoggingOutScreenProps) {
  const colors = useThemeColors();

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View className="flex-1 items-center justify-center bg-background px-6">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="mt-4 text-center font-sans-medium text-base text-foreground">
          Déconnexion en cours…
        </Text>
      </View>
    </Modal>
  );
}
