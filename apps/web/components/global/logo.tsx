import Image from "next/image";

import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { icon: 18, text: "text-lg" },
  md: { icon: 28, text: "text-2xl" },
  lg: { icon: 42, text: "text-4xl" },
} as const;

interface LogoProps {
  size?: keyof typeof SIZES;
  iconOnly?: boolean;
  className?: string;
}

export function Logo({ size = "md", iconOnly = false, className }: LogoProps) {
  const { icon, text } = SIZES[size];

  return (
    <span className={cn("inline-flex items-center gap-1 text-foreground", text, className)}>
      <Image src={siteConfig.logo} alt="" width={icon} height={icon} priority />
      {iconOnly ? (
        <span className="sr-only">{siteConfig.name}</span>
      ) : (
        <span className="font-extrabold tracking-tight">
          {siteConfig.shortName}
          <span className="text-primary">.</span>
        </span>
      )}
    </span>
  );
}
