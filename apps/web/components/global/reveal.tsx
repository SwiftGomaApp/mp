"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface RevealProps extends React.ComponentProps<"div"> {
  delay?: number;
}

export function Reveal({ delay = 0, className, style, children, ...props }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && entry.boundingClientRect.top >= 0) return;
        setShown(true);
        observer.disconnect();
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ animationDelay: `${delay}ms`, ...style }}
      className={cn(
        shown
          ? "animate-in duration-700 ease-out fade-in slide-in-from-bottom-3 fill-mode-both motion-reduce:animate-none"
          : "opacity-0 motion-reduce:opacity-100",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
