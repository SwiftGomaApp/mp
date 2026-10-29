import { BottomSheet, Group, Host, RNHostView, VStack } from "@expo/ui/swift-ui";
import {
  interactiveDismissDisabled,
  presentationBackground,
  presentationDetents,
  presentationDragIndicator,
} from "@expo/ui/swift-ui/modifiers";

import { useThemeColors } from "@/core/theme";

import type { AppSheetProps } from "./app-sheet.types";

export function AppSheet({
  isOpen,
  onOpenChange,
  children,
  detents = ["medium", "large"],
  showDragIndicator = false,
  dismissible = true,
}: AppSheetProps) {
  const colors = useThemeColors();

  return (
    <Host style={{ position: "absolute", width: 0, height: 0 }}>
      <VStack>
        <BottomSheet isPresented={isOpen} onIsPresentedChange={onOpenChange}>
          <Group
            modifiers={[
              presentationDetents(detents),
              presentationDragIndicator(showDragIndicator ? "visible" : "hidden"),
              presentationBackground(colors.background),
              interactiveDismissDisabled(!dismissible),
            ]}
          >
            <RNHostView>{children}</RNHostView>
          </Group>
        </BottomSheet>
      </VStack>
    </Host>
  );
}
