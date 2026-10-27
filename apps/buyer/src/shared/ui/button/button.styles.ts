import type { ThemeColors } from "@/core/theme";
import { ButtonSize, LabelButtonProps } from "../../../../types";

export type ButtonVariant = NonNullable<LabelButtonProps["variant"]>;

export const sizeStyles: Record<
  ButtonSize,
  { box: string; text: string; icon: string; iconSize: number; hitSlop: number }
> = {
  lg: {
    box: "h-[46px] px-5",
    text: "text-[15px]",
    icon: "h-[46px] w-[46px]",
    iconSize: 22,
    hitSlop: 0,
  },
  md: {
    box: "h-[40px] px-4",
    text: "text-[14px]",
    icon: "h-[40px] w-[40px]",
    iconSize: 20,
    hitSlop: 0,
  },
  sm: {
    box: "h-[32px] px-3.5",
    text: "text-[13px]",
    icon: "h-[32px] w-[32px]",
    iconSize: 16,
    hitSlop: 6,
  },
};

export const variantStyles: Record<ButtonVariant, { box: string; text: string }> = {
  default: {
    box: "bg-primary active:bg-primary/90",
    text: "text-primary-foreground",
  },
  outline: {
    box: "border border-input bg-background active:bg-accent",
    text: "text-foreground",
  },
  danger: {
    box: "bg-destructive active:bg-destructive/90",
    text: "text-white dark:text-background",
  },
};

export function accentColor(variant: ButtonVariant, colors: ThemeColors): string {
  if (variant === "danger") return colors.destructive;
  if (variant === "outline") return colors.foreground;
  return colors.primary;
}

export function contentColor(variant: ButtonVariant, colors: ThemeColors, isDark: boolean): string {
  if (variant === "outline") return colors.foreground;
  if (variant === "danger") return isDark ? colors.background : "#FFFFFF";
  return colors.primaryForeground;
}
