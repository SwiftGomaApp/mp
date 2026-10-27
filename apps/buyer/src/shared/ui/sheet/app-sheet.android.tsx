import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Pressable, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemeColors } from "@/core/theme";

import type { AppSheetProps, SheetDetent } from "./app-sheet.types";

const ANIMATION_MS = 240;
const MAX_SCREEN_FRACTION = 0.92;

function detentHeight(detent: SheetDetent, windowHeight: number) {
  if (detent === "medium") return windowHeight * 0.5;
  if (detent === "large") return windowHeight * MAX_SCREEN_FRACTION;
  if ("fraction" in detent) return windowHeight * detent.fraction;
  return detent.height;
}

export function AppSheet({
  isOpen,
  onOpenChange,
  children,
  detents = ["medium", "large"],
  showDragIndicator = false,
  dismissible = true,
}: AppSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [mounted, setMounted] = useState(isOpen);
  const progress = useSharedValue(0);

  if (isOpen && !mounted) setMounted(true);

  useEffect(() => {
    if (isOpen) {
      progress.value = withTiming(1, { duration: ANIMATION_MS });
      return;
    }
    progress.value = withTiming(0, { duration: ANIMATION_MS });
    const timer = setTimeout(() => setMounted(false), ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [isOpen, progress]);

  const sheetHeight = Math.min(
    Math.max(...detents.map((d) => detentHeight(d, windowHeight))),
    windowHeight - insets.top,
  );

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * sheetHeight }],
  }));

  const close = () => {
    if (dismissible) onOpenChange(false);
  };

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}
    >
      <View style={{ flex: 1 }}>
        <Animated.View
          style={[
            { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
            { backgroundColor: "rgba(0,0,0,0.4)" },
            backdropStyle,
          ]}
        >
          <Pressable style={{ flex: 1 }} onPress={close} />
        </Animated.View>

        <KeyboardAvoidingView
          behavior="padding"
          style={{ flex: 1, justifyContent: "flex-end", pointerEvents: "box-none" }}
        >
          <Animated.View
            style={[
              {
                height: sheetHeight + insets.bottom,
                paddingBottom: insets.bottom,
                backgroundColor: colors.background,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                overflow: "hidden",
              },
              sheetStyle,
            ]}
          >
            {showDragIndicator ? (
              <View
                style={{
                  alignSelf: "center",
                  marginTop: 10,
                  height: 4,
                  width: 36,
                  borderRadius: 2,
                  backgroundColor: colors.mutedForeground,
                  opacity: 0.4,
                }}
              />
            ) : null}
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
