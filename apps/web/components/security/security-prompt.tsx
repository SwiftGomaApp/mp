"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  Check,
  Fingerprint,
  KeyRound,
  LifeBuoy,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SecurityTask, SecurityTaskKey } from "@/lib/security";

const SNOOZE_KEY = "swiftgoma:security-prompt-snoozed-until";
const SNOOZE_MS = 24 * 60 * 60 * 1000;

export const TASK_COPY: Record<
  SecurityTaskKey,
  { title: string; description: string; icon: LucideIcon }
> = {
  TWO_FACTOR: {
    title: "Double vérification",
    description: "Un code de votre téléphone en plus, pour bloquer les accès non autorisés.",
    icon: Smartphone,
  },
  RECOVERY_CONTACT: {
    title: "Contact de récupération",
    description:
      "Un e-mail ou un numéro de secours pour retrouver votre compte si vous perdez l’accès.",
    icon: LifeBuoy,
  },
  PASSKEY: {
    title: "Empreinte ou visage",
    description: "Connectez-vous en un geste, sans mot de passe à taper.",
    icon: Fingerprint,
  },
  PASSWORD: {
    title: "Mot de passe",
    description: "Une méthode de connexion de plus, pour ne jamais être bloqué.",
    icon: KeyRound,
  },
};

const LEVELS = [
  {
    min: 1,
    label: "Excellent",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  {
    min: 0.75,
    label: "Bon",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  { min: 0.5, label: "Moyen", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  { min: 0, label: "Faible", className: "bg-destructive/10 text-destructive" },
];

export function getSecurityLevel(done: number, total: number) {
  const ratio = done / total;
  return LEVELS.find((item) => ratio >= item.min) ?? LEVELS[LEVELS.length - 1];
}

function readSnoozed() {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
}

function writeSnoozed(snoozed: boolean) {
  try {
    if (snoozed) localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    else localStorage.removeItem(SNOOZE_KEY);
  } catch {}
}

export function ProgressRing({
  done,
  total,
  size = 48,
}: {
  done: number;
  total: number;
  size?: number;
}) {
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - done / total)}
          className="stroke-primary transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">
        {done}/{total}
      </span>
    </div>
  );
}

interface SecurityPromptProps {
  tasks: SecurityTask[];
  onConfigure: (key: SecurityTaskKey) => void;
}

export function SecurityPrompt({ tasks, onConfigure }: SecurityPromptProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(readSnoozed);

  const done = tasks.filter((task) => task.done).length;
  const total = tasks.length;
  const missing = tasks.filter((task) => !task.done);

  if (
    missing.length === 0 ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/profile/security")
  ) {
    return null;
  }

  const level = getSecurityLevel(done, total);

  function collapse() {
    writeSnoozed(true);
    setCollapsed(true);
  }

  function expand() {
    writeSnoozed(false);
    setCollapsed(false);
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={expand}
        aria-label={`Sécurité du compte : ${done} étapes sur ${total}. Afficher les étapes restantes.`}
        className="fixed right-4 bottom-4 z-50 flex items-center gap-2.5 rounded-full border bg-card py-1.5 pr-4 pl-1.5 text-sm font-medium shadow-lg transition-shadow outline-none animate-in fade-in slide-in-from-bottom-4 hover:shadow-xl focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ProgressRing done={done} total={total} size={36} />
        Sécurité du compte
      </button>
    );
  }

  return (
    <section
      aria-label="Sécurité du compte"
      className="fixed right-4 bottom-4 left-4 z-50 flex max-h-[calc(100svh-2rem)] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300 sm:left-auto sm:w-96"
    >
      <header className="flex items-start gap-3 p-4 pb-3">
        <ProgressRing done={done} total={total} />
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Sécurisez votre compte</h2>
            <Badge variant="secondary" className={cn("border-0", level.className)}>
              {level.label}
            </Badge>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            {missing.length === 1
              ? "Plus qu’une étape pour protéger votre compte."
              : `${missing.length} étapes pour protéger votre compte, votre argent et vos commandes.`}
          </p>
        </div>
        <button
          type="button"
          onClick={collapse}
          aria-label="Me le rappeler plus tard"
          className="-mt-1 -mr-1 rounded-md p-1.5 text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X className="size-4" />
        </button>
      </header>

      <ul className="grid gap-1 overflow-y-auto px-2 pb-2">
        {missing.map((task, index) => {
          const { title, description, icon: Icon } = TASK_COPY[task.key];

          return (
            <li
              key={task.key}
              className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-muted/50"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4.5" />
              </span>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="text-sm font-medium">{title}</span>
                <span className="text-xs leading-4.5 text-muted-foreground">{description}</span>
              </span>
              <Button
                size="sm"
                variant={index === 0 ? "default" : "outline"}
                onClick={() => onConfigure(task.key)}
              >
                Configurer
              </Button>
            </li>
          );
        })}

        {tasks
          .filter((task) => task.done)
          .map((task) => (
            <li key={task.key} className="flex items-center gap-3 p-2 text-muted-foreground">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Check className="size-4.5" />
              </span>
              <span className="flex-1 text-sm">{TASK_COPY[task.key].title}</span>
              <span className="text-xs">Activé</span>
            </li>
          ))}
      </ul>

      <footer className="flex items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2.5">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {done === 0 ? (
            <ShieldAlert className="size-3.5" aria-hidden="true" />
          ) : (
            <ShieldCheck className="size-3.5" aria-hidden="true" />
          )}
          Environ 2 minutes
        </p>
        <Button size="sm" variant="ghost" onClick={collapse}>
          Plus tard
        </Button>
      </footer>
    </section>
  );
}
