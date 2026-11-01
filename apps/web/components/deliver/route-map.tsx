import { Bell, Check, House, Store } from "lucide-react";

import { cn } from "@/lib/utils";

const ROUTE = "M135 375V289Q135 275 149 275H481Q495 275 495 261V189Q495 175 509 175H735";
const COLUMNS = [-60, 30, 150, 270, 390, 510, 630, 750, 870];
const ROWS = [90, 190, 290, 390];

const at = (x: number, y: number) => ({
  left: `${(x / 900) * 100}%`,
  top: `${(y / 460) * 100}%`,
});

const PIN =
  "absolute flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-card shadow-sm sm:size-10";
const PIN_LABEL =
  "absolute top-full left-1/2 mt-1.5 hidden sm:block -translate-x-1/2 text-[0.65rem] text-muted-foreground";
const CARD =
  "absolute flex w-max items-center gap-2.5 rounded-xl border bg-card p-2.5 shadow-sm sm:p-3";

export function RouteMap({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative aspect-900/460 w-full overflow-hidden rounded-3xl border bg-card",
        className,
      )}
    >
      <svg viewBox="0 0 900 460" className="absolute inset-0 size-full">
        <path
          d="M-10 -10H910V38C820 62 740 28 650 46S470 70 380 44S190 22 100 48S20 56 -10 40Z"
          className="fill-muted"
        />
        {ROWS.flatMap((y) =>
          COLUMNS.map((x) => (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="90"
              height="70"
              rx="8"
              className="fill-muted"
            />
          )),
        )}

        <path
          d={ROUTE}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-border"
        />
        <path
          d={ROUTE}
          pathLength={100}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="hm-trail stroke-primary"
        />

        <g className="hm-rider opacity-0">
          <circle r="18" className="fill-primary opacity-20" />
          <circle r="8" strokeWidth="3" className="fill-primary stroke-card" />
        </g>
      </svg>

      <div className={PIN} style={at(135, 375)}>
        <span className="hm-ping absolute inset-0 rounded-full border-2 border-primary opacity-0" />
        <Store className="size-4" />
        <span className={PIN_LABEL}>Boutique</span>
      </div>

      <div className={PIN} style={at(735, 175)}>
        <span className="hm-ping-end absolute inset-0 rounded-full border-2 border-primary opacity-0" />
        <House className="size-4" />
        <span className="hm-done absolute inset-0 flex items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-4" />
        </span>
        <span className={PIN_LABEL}>Acheteur</span>
      </div>

      <div className={cn(CARD, "hm-card-a top-[71%] left-[19%]")}>
        <span className="flex size-7 items-center justify-center rounded-full bg-muted">
          <Bell className="size-3.5" />
        </span>
        <span className="grid leading-tight">
          <span className="text-[0.65rem] font-semibold sm:text-xs">Nouvelle course</span>
          <span className="hidden text-[0.65rem] text-muted-foreground sm:block">
            Boutique Amani → Himbi
          </span>
        </span>
      </div>

      <div className={cn(CARD, "hm-card-b top-[54%] right-[3%] sm:top-[47%]")}>
        <span className="flex size-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <Check className="size-3.5" />
        </span>
        <span className="grid leading-tight">
          <span className="text-[0.65rem] font-semibold sm:text-xs">Remise confirmée</span>
          <span className="hidden text-[0.65rem] text-muted-foreground sm:block">
            Code QR scanné
          </span>
        </span>
      </div>
    </div>
  );
}
