import type { SymbolViewProps } from "expo-symbols";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";

export type ButtonSize = "lg" | "md" | "sm";

export type ButtonIcon = Required<
  Pick<Exclude<SymbolViewProps["name"], string>, "ios" | "android">
>;

type ButtonBaseProps = {
  size?: ButtonSize;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export type LabelButtonProps = ButtonBaseProps & {
  variant?: "default" | "outline" | "danger";
  label: string;
  fullWidth?: boolean;
  loading?: boolean;
  /** Something shown before the label, for example a logo. */
  leading?: ReactNode;
};

export type IconButtonProps = ButtonBaseProps & {
  variant: "icon";
  icon: ButtonIcon;
  accessibilityLabel: string;
};

export type ButtonProps = LabelButtonProps | IconButtonProps;
