import { Text, View, type ViewStyle } from "react-native";
import Animated, { type AnimatedStyle } from "react-native-reanimated";

type WordmarkProps = {
  dotStyle?: AnimatedStyle<ViewStyle>;
};

export function Wordmark({ dotStyle }: WordmarkProps) {
  return (
    <>
      <Text className="mr-[3px] font-sans-extrabold text-[24px] tracking-[-1.2px] text-foreground">
        SwiftGoma
      </Text>
      <Animated.View style={dotStyle}>
        <View className="mb-[5.5px] h-[4px] w-[4px] bg-primary" />
      </Animated.View>
    </>
  );
}
