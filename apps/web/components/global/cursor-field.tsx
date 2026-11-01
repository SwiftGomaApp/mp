"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

interface CursorFieldProps {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function CursorField({ className, style, children }: CursorFieldProps) {
  const root = useRef<HTMLElement>(null);
  const rider = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    const dot = rider.current;
    if (!element || !dot) return;
    if (!window.matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)").matches)
      return;

    const target = { x: 0, y: 0 };
    const soft = { x: 0, y: 0 };
    const chase = { x: 0, y: 0 };
    let frame = 0;

    const tick = () => {
      soft.x += (target.x - soft.x) * 0.12;
      soft.y += (target.y - soft.y) * 0.12;
      chase.x += (target.x - chase.x) * 0.07;
      chase.y += (target.y - chase.y) * 0.07;

      const { width, height } = element.getBoundingClientRect();
      element.style.setProperty("--px", ((soft.x / width) * 2 - 1).toFixed(3));
      element.style.setProperty("--py", ((soft.y / height) * 2 - 1).toFixed(3));
      element.style.setProperty("--mx", `${soft.x.toFixed(1)}px`);
      element.style.setProperty("--my", `${soft.y.toFixed(1)}px`);
      dot.style.transform = `translate3d(${chase.x.toFixed(1)}px, ${chase.y.toFixed(1)}px, 0)`;

      const settled =
        Math.abs(target.x - soft.x) < 0.1 &&
        Math.abs(target.y - soft.y) < 0.1 &&
        Math.abs(target.x - chase.x) < 0.1 &&
        Math.abs(target.y - chase.y) < 0.1;
      frame = settled ? 0 : requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      target.x = event.clientX - rect.left;
      target.y = event.clientY - rect.top;
      element.style.setProperty("--spot", "1");
      dot.style.opacity = "1";
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const onLeave = () => {
      element.style.setProperty("--spot", "0");
      dot.style.opacity = "0";
    };

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <main
      ref={root}
      style={
        {
          "--px": 0,
          "--py": 0,
          "--mx": "50%",
          "--my": "50%",
          "--spot": 0,
          ...style,
        } as CSSProperties
      }
      className={className}
    >
      <div
        aria-hidden
        style={{
          opacity: "var(--spot)",
          backgroundImage: "radial-gradient(var(--primary) 1.4px, transparent 1.4px)",
          backgroundSize: "20px 20px",
        }}
        className="pointer-events-none absolute inset-0 transition-opacity duration-500 mask-[radial-gradient(circle_190px_at_var(--mx)_var(--my),black,transparent)]"
      />

      <div
        ref={rider}
        aria-hidden
        style={{ opacity: 0 }}
        className="pointer-events-none absolute top-0 left-0 z-20 transition-opacity duration-300"
      >
        <span className="absolute -top-2.5 -left-2.5 size-5 rounded-full bg-primary/20" />
        <span className="absolute -top-1 -left-1 size-2 rounded-full bg-primary" />
      </div>

      {children}
    </main>
  );
}
