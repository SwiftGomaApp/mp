import { useEffect } from "react";
import { Image, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { Wordmark } from "./wordmark";

export const LOGO_REVEAL_MS = 2200;

const EASE_OUT = Easing.bezier(0.0, 0.0, 0.58, 1.0);
const EASE_OUT_BACK = Easing.bezier(0.175, 0.885, 0.32, 1.275);
const EASE_IN_OUT_CUBIC = Easing.bezier(0.645, 0.045, 0.355, 1.0);
const EASE_OUT_CUBIC = Easing.bezier(0.215, 0.61, 0.355, 1.0);

const ICON_START_SIZE = 50;
const ICON_END_SIZE = 20;

type EasingFn = ReturnType<typeof Easing.bezier>;

function interval(to: number, begin: number, end: number, easing: EasingFn) {
  return withDelay(
    begin * LOGO_REVEAL_MS,
    withTiming(to, { duration: (end - begin) * LOGO_REVEAL_MS, easing }),
  );
}

type LogoRevealProps = {
  inverted?: boolean;
  scale?: number;
};

export function LogoReveal({ inverted = false, scale = 1 }: LogoRevealProps) {
  const iconOpacity = useSharedValue(0);
  const iconPopScale = useSharedValue(0.6);
  const iconSize = useSharedValue(ICON_START_SIZE);
  const textReveal = useSharedValue(0);
  const dotScale = useSharedValue(0);
  const wordmarkWidth = useSharedValue(0);

  useEffect(() => {
    iconOpacity.set(interval(1, 0.0, 0.18, EASE_OUT));
    iconPopScale.set(interval(1, 0.0, 0.28, EASE_OUT_BACK));
    iconSize.set(interval(ICON_END_SIZE, 0.38, 0.72, EASE_IN_OUT_CUBIC));
    textReveal.set(interval(1, 0.42, 0.78, EASE_OUT_CUBIC));
    dotScale.set(interval(1, 0.8, 0.95, EASE_OUT_BACK));
  }, [iconOpacity, iconPopScale, iconSize, textReveal, dotScale]);

  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.get(),
    width: iconSize.get(),
    height: iconSize.get(),
    transform: [{ scale: iconPopScale.get() }],
  }));

  const revealStyle = useAnimatedStyle(() => ({
    overflow: "hidden",
    width: wordmarkWidth.get() * textReveal.get(),
    opacity: textReveal.get(),
  }));

  const wordmarkRowStyle = useAnimatedStyle(() => ({
    width: wordmarkWidth.get(),
  }));

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: Math.min(Math.max(dotScale.get(), 0), 1.2) }],
  }));

  return (
    <>
      <View className="pointer-events-none absolute left-0 top-0 flex-row opacity-0">
        <View
          className="flex-row items-end pl-[8px]"
          onLayout={(e) => wordmarkWidth.set(e.nativeEvent.layout.width)}
        >
          <Wordmark />
        </View>
      </View>

      <View className="flex-row items-center" style={{ transform: [{ scale }] }}>
        <Animated.View style={iconStyle}>
          <Image
            source={require("@/assets/images/logo.png")}
            className="h-full w-full"
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View style={revealStyle}>
          <Animated.View style={wordmarkRowStyle}>
            <View className="flex-row items-end pl-[5px]">
              <Wordmark dotStyle={dotStyle} inverted={inverted} />
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    </>
  );
}
