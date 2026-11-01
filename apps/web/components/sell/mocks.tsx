"use client";

import { useEffect, useRef, useState } from "react";

import {
  Bike,
  Bell,
  Check,
  FileCheck2,
  Loader2,
  MessageSquare,
  QrCode,
  ShoppingBag,
  Smartphone,
  Store,
  Volume2,
} from "lucide-react";

import { cn } from "@/lib/utils";

function Mock({
  className,
  children,
  interactive = false,
  ref,
}: {
  className?: string;
  ref?: React.Ref<HTMLDivElement>;
  children: React.ReactNode;
  interactive?: boolean;
}) {
  return (
    <div
      ref={ref}
      aria-hidden={interactive ? undefined : true}
      className={cn(
        !interactive && "pointer-events-none select-none",
        "w-full max-w-xs rounded-xl border bg-card p-4 text-left text-card-foreground shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

const Pill = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground",
      className,
    )}
  >
    {children}
  </span>
);

const PRODUCTS = [
  { name: "Sac en cuir", price: "45 $", stock: "12 en stock" },
  { name: "Écouteurs sans fil", price: "30 $", stock: "5 en stock" },
  { name: "Robe wax", price: "62 500 FC", stock: "8 en stock" },
] as const;

export function ShopMock({ className }: { className?: string }) {
  return (
    <Mock className={className}>
      <div className="flex items-center gap-3 border-b pb-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Store className="size-4" />
        </span>
        <div className="grid flex-1 leading-tight">
          <span className="text-sm font-semibold">Boutique Amani</span>
          <span className="text-[0.65rem] text-muted-foreground">Mode et accessoires</span>
        </div>
        <Pill className="text-emerald-600 dark:text-emerald-400">
          <span className="size-1.5 rounded-full bg-current" />
          Ouverte
        </Pill>
      </div>
      <ul className="mt-3 grid gap-2.5">
        {PRODUCTS.map(({ name, price, stock }) => (
          <li key={name} className="flex items-center gap-3">
            <span className="size-9 shrink-0 rounded-md bg-muted" />
            <div className="grid flex-1 leading-tight">
              <span className="text-xs font-medium">{name}</span>
              <span className="text-[0.65rem] text-muted-foreground">{stock}</span>
            </div>
            <span className="text-xs font-semibold tabular-nums">{price}</span>
          </li>
        ))}
      </ul>
    </Mock>
  );
}

export function OrderMock({ className }: { className?: string }) {
  return (
    <Mock className={className}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <ShoppingBag className="size-4 text-primary" />
          Nouvelle commande
        </span>
        <Pill>#1042</Pill>
      </div>
      <ul className="mt-3 grid gap-1.5 text-xs">
        <li className="flex justify-between">
          <span>2 × Sac en cuir</span>
          <span className="tabular-nums">90 $</span>
        </li>
        <li className="flex justify-between">
          <span>1 × Écouteurs sans fil</span>
          <span className="tabular-nums">30 $</span>
        </li>
        <li className="mt-1 flex justify-between border-t pt-2 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">120 $</span>
        </li>
      </ul>
      <div className="mt-4 grid gap-1.5">
        <div className="flex justify-between text-[0.65rem] text-muted-foreground">
          <span>Temps pour répondre</span>
          <span className="tabular-nums">15 min</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-0 animate-progress-fill rounded-full bg-primary [--slide-duration:8s] motion-reduce:w-1/2 motion-reduce:animate-none" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs font-medium">
        <span className="rounded-md border py-1.5">Refuser</span>
        <span className="rounded-md bg-primary py-1.5 text-primary-foreground">Accepter</span>
      </div>
    </Mock>
  );
}

type WithdrawStep = "idle" | "amount" | "otp" | "success";

const WITHDRAW_AMOUNT = "80,00";
const WITHDRAW_CODE = "482917";
const TYPING_MS = 230;
const AUTO_START_TICKS = 5;

function isOnScreen(element: HTMLElement) {
  const { top, bottom, height } = element.getBoundingClientRect();
  const visible = Math.min(bottom, window.innerHeight) - Math.max(top, 0);
  if (visible < height * 0.8) return false;
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    if (getComputedStyle(node).opacity === "0") return false;
  }
  return true;
}

export function WalletMock({ className }: { className?: string }) {
  const [step, setStep] = useState<WithdrawStep>("idle");
  const [typed, setTyped] = useState("");
  const [code, setCode] = useState("");
  const [sms, setSms] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const played = useRef(false);

  useEffect(() => {
    if (step !== "idle" || played.current) return;
    let seen = 0;
    const timer = setInterval(() => {
      const card = cardRef.current;
      seen = card && isOnScreen(card) ? seen + 1 : 0;
      if (seen >= AUTO_START_TICKS) {
        clearInterval(timer);
        start();
      }
    }, 500);
    return () => clearInterval(timer);
  }, [step]);

  useEffect(() => {
    if (step !== "amount") return;
    let index = 0;
    let next: ReturnType<typeof setTimeout> | undefined;
    const timer = setInterval(() => {
      index += 1;
      setTyped(WITHDRAW_AMOUNT.slice(0, index));
      if (index >= WITHDRAW_AMOUNT.length) {
        clearInterval(timer);
        next = setTimeout(() => setStep("otp"), 1000);
      }
    }, TYPING_MS);
    return () => {
      clearInterval(timer);
      clearTimeout(next);
    };
  }, [step]);

  useEffect(() => {
    if (step !== "otp") return;
    let index = 0;
    let next: ReturnType<typeof setTimeout> | undefined;
    const timer = setInterval(() => {
      index += 1;
      setCode(WITHDRAW_CODE.slice(0, index));
      if (index >= WITHDRAW_CODE.length) {
        clearInterval(timer);
        next = setTimeout(() => setStep("success"), 800);
      }
    }, TYPING_MS + 40);
    return () => {
      clearInterval(timer);
      clearTimeout(next);
    };
  }, [step]);

  useEffect(() => {
    if (step !== "success") return;
    const timer = setTimeout(() => setSms(true), 1000);
    return () => clearTimeout(timer);
  }, [step]);

  function start() {
    played.current = true;
    setTyped("");
    setCode("");
    setSms(false);
    setStep("amount");
  }

  function replay() {
    setSms(false);
    setStep("idle");
  }

  const idle = step === "idle";
  const panel =
    "mt-4 grid animate-in duration-500 fade-in slide-in-from-bottom-6 motion-reduce:animate-none";

  return (
    <Mock
      interactive
      ref={cardRef}
      className={cn("relative h-58 overflow-hidden", className)}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[0.65rem] text-muted-foreground">Solde disponible</p>
          <p
            className={cn(
              "mt-0.5 font-bold tracking-tight tabular-nums transition-all duration-500",
              idle ? "text-2xl" : "text-base",
            )}
          >
            {step === "success" ? "48,50 $" : "128,50 $"}
          </p>
        </div>
        {!idle && <Pill className="animate-in duration-500 fade-in">Mobile Money</Pill>}
      </div>

      <div
        inert={!idle}
        className={cn(
          "grid transition-all duration-500 ease-out motion-reduce:transition-none",
          idle ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="mt-3 flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-xs">
            <span className="text-muted-foreground">En attente (24 h)</span>
            <span className="font-medium tabular-nums">45,00 $</span>
          </div>
          <ul className="mt-3 grid gap-2 text-xs">
            <li className="flex justify-between">
              <span>Commande #1038</span>
              <span className="font-medium text-emerald-600 tabular-nums dark:text-emerald-400">
                + 36,00 $
              </span>
            </li>
            <li className="flex justify-between">
              <span>Retrait M-Pesa</span>
              <span className="font-medium tabular-nums">− 80,00 $</span>
            </li>
          </ul>
          <button
            type="button"
            onClick={start}
            className="mt-4 w-full cursor-pointer rounded-md bg-primary py-1.5 text-center text-xs font-medium text-primary-foreground transition-opacity outline-none hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Retirer sur Mobile Money
          </button>
        </div>
      </div>

      {step === "amount" && (
        <div key="amount" className={cn(panel, "gap-4")}>
          <p className="text-xs font-semibold">Montant à retirer</p>
          <p className="flex h-12 items-center justify-center rounded-lg border bg-muted/40 text-3xl font-bold tracking-tight tabular-nums">
            {typed}
            <span className="ml-0.5 inline-block h-7 w-0.5 animate-pulse bg-primary" />
            <span className="ml-1.5 text-xl text-muted-foreground">$</span>
          </p>
          <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-muted text-foreground">
              <Smartphone className="size-3.5" />
            </span>
            <span className="grid leading-tight">
              <span className="text-xs font-medium">M-Pesa</span>
              <span className="text-[0.65rem] text-muted-foreground">+243 855 ••• 387</span>
            </span>
          </div>
        </div>
      )}

      {step === "otp" && (
        <div key="otp" className={cn(panel, "gap-4")}>
          <div className="grid gap-0.5">
            <p className="text-xs font-semibold">Code de confirmation</p>
            <p className="text-[0.65rem] text-muted-foreground">
              Envoyé par SMS au +243 855 ••• 387
            </p>
          </div>
          <div className="flex justify-between gap-1.5">
            {[...WITHDRAW_CODE].map((_, index) => {
              const digit = code[index];
              const current = index === code.length;
              return (
                <span
                  key={index}
                  className={cn(
                    "flex h-11 w-full items-center justify-center rounded-lg border text-lg font-semibold tabular-nums transition-colors duration-200",
                    digit && "border-foreground/40 bg-muted/40",
                    current && "border-primary",
                  )}
                >
                  {digit ? (
                    <span className="animate-in duration-200 zoom-in-50 fade-in">{digit}</span>
                  ) : (
                    current && <span className="h-5 w-0.5 animate-pulse bg-primary" />
                  )}
                </span>
              );
            })}
          </div>
          <p className="text-center text-[0.65rem] text-muted-foreground">Vérification en cours…</p>
        </div>
      )}

      {step === "success" && (
        <div key="success" className={cn(panel, "justify-items-center gap-3 text-center")}>
          <span className="flex size-12 animate-in items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 duration-500 zoom-in-50 dark:text-emerald-400">
            <Check className="size-6" />
          </span>
          <div className="grid gap-0.5">
            <p className="text-sm font-semibold">Retrait envoyé</p>
            <p className="text-[0.65rem] text-muted-foreground">80,00 $ vers votre M-Pesa</p>
          </div>
          <button
            type="button"
            onClick={replay}
            className="cursor-pointer text-[0.65rem] text-muted-foreground underline underline-offset-4 outline-none hover:text-foreground focus-visible:text-foreground"
          >
            Rejouer
          </button>
        </div>
      )}

      {sms && (
        <div
          role="status"
          className="absolute inset-x-3 top-3 z-10 flex animate-in items-start gap-2.5 rounded-xl border bg-popover/95 p-3 shadow-lg backdrop-blur duration-500 fade-in slide-in-from-top-8"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white">
            <MessageSquare className="size-3.5" />
          </span>
          <span className="grid flex-1 gap-0.5 leading-tight">
            <span className="flex items-center justify-between text-[0.65rem] text-muted-foreground">
              <span className="font-medium uppercase">Messages</span>
              <span>maintenant</span>
            </span>
            <span className="text-xs font-medium">M-Pesa</span>
            <span className="text-[0.7rem] text-muted-foreground">
              Vous avez reçu 80,00 $ de SwiftGoma.
            </span>
          </span>
        </div>
      )}
    </Mock>
  );
}

const RIDERS = [
  { name: "Patrick M.", vehicle: "Moto" },
  { name: "Grâce K.", vehicle: "Moto" },
  { name: "Jonathan B.", vehicle: "Voiture" },
] as const;

export function RiderMock({ className }: { className?: string }) {
  const [selected, setSelected] = useState(0);

  return (
    <Mock interactive className={className}>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Bike className="size-4 text-primary" />
        Choisir un livreur
      </p>
      <div role="radiogroup" aria-label="Livreur" className="mt-3 grid gap-2">
        {RIDERS.map(({ name, vehicle }, index) => {
          const active = selected === index;
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(index)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all duration-300 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active
                  ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                  : "hover:border-muted-foreground/40 hover:bg-muted/40",
              )}
            >
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-[0.65rem] font-semibold transition-colors duration-300",
                  active ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {name[0]}
              </span>
              <span className="grid flex-1 leading-tight">
                <span className="text-xs font-medium">{name}</span>
                <span className="text-[0.65rem] text-muted-foreground">{vehicle}</span>
              </span>
              <Pill className="text-emerald-600 dark:text-emerald-400">
                <Check className="size-3" />
                Vérifié
              </Pill>
              <span
                aria-hidden
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full border transition-all duration-300",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/40",
                )}
              >
                <Check
                  className={cn(
                    "size-2.5 transition-transform duration-300",
                    active ? "scale-100" : "scale-0",
                  )}
                />
              </span>
            </button>
          );
        })}
      </div>
    </Mock>
  );
}

const QR_CELLS = [
  "1110101",
  "1010011",
  "1110110",
  "0001001",
  "1101111",
  "0100101",
  "1111010",
] as const;

export function QrMock({ className }: { className?: string }) {
  return (
    <Mock className={cn("flex flex-col items-center gap-3", className)}>
      <div className="peer/qr group/qr pointer-events-auto relative grid cursor-crosshair grid-cols-7 gap-0.5 overflow-hidden rounded-lg bg-white p-2">
        {QR_CELLS.flatMap((row, y) =>
          [...row].map((cell, x) => (
            <span
              key={`${y}-${x}`}
              style={{ animationDelay: `${(x * 0.09 + y * 0.13).toFixed(2)}s` }}
              className={cn(
                "size-3.5 rounded-xs group-hover/qr:animate-[qr-flicker_1.4s_ease-in-out_infinite] motion-reduce:group-hover/qr:animate-none",
                cell === "1" ? "bg-neutral-900" : "bg-white",
              )}
            />
          )),
        )}
        <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-primary opacity-0 shadow-[0_0_8px_1px] shadow-primary group-hover/qr:animate-[qr-scan_1.6s_linear_infinite] group-hover/qr:opacity-100 motion-reduce:hidden" />
      </div>
      <p className="relative flex h-4 items-center text-xs font-medium peer-hover/qr:[&>span:first-child]:hidden peer-hover/qr:[&>span:last-child]:flex">
        <span className="flex items-center gap-1.5">
          <QrCode className="size-3.5 text-primary" />
          Remise confirmée
        </span>
        <span className="hidden items-center gap-1.5 text-primary">
          <QrCode className="size-3.5" />
          Scan en cours…
        </span>
      </p>
      <p className="text-center text-[0.65rem] text-muted-foreground">
        Le paiement est réparti : vous recevez votre part.
      </p>
    </Mock>
  );
}

function useLoopingTick(
  ref: React.RefObject<HTMLElement | null>,
  length: number,
  intervalMs: number,
  onTick?: (tick: number) => void,
) {
  const [tick, setTick] = useState(0);
  const latest = useRef({ tick: 0, onTick });

  useEffect(() => {
    latest.current.onTick = onTick;
  });

  useEffect(() => {
    let seen = 0;
    const timer = setInterval(() => {
      const element = ref.current;
      seen = element && isOnScreen(element) ? seen + 1 : 0;
      if (seen < AUTO_START_TICKS) return;
      const next = (latest.current.tick + 1) % length;
      latest.current.tick = next;
      setTick(next);
      latest.current.onTick?.(next);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [ref, length, intervalMs]);

  return tick;
}

const DOCUMENTS = [
  "Pièce d’identité",
  "Registre de commerce",
  "Photos de la boutique",
  "Preuve d’adresse",
] as const;

type DocumentStatus = "waiting" | "reviewing" | "approved" | "missing";

function documentStatus(index: number, tick: number): DocumentStatus {
  if (index < 3) {
    if (tick >= 2 + index * 2) return "approved";
    return tick >= 1 + index * 2 ? "reviewing" : "waiting";
  }
  if (tick >= 11) return "approved";
  if (tick >= 10) return "reviewing";
  if (tick >= 8) return "missing";
  return tick >= 7 ? "reviewing" : "waiting";
}

const DOCUMENT_LOOP = 19;

function DocumentPill({ status }: { status: DocumentStatus }) {
  if (status === "approved") {
    return (
      <Pill className="animate-in text-emerald-600 duration-300 zoom-in-90 dark:text-emerald-400">
        <Check className="size-3" />
        Approuvé
      </Pill>
    );
  }
  if (status === "reviewing") {
    return (
      <Pill>
        <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
        En examen
      </Pill>
    );
  }
  if (status === "missing") {
    return (
      <Pill className="animate-in text-amber-600 duration-300 zoom-in-90 dark:text-amber-400">
        À compléter
      </Pill>
    );
  }
  return <Pill>En attente</Pill>;
}

export function DocumentsMock({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const tick = useLoopingTick(ref, DOCUMENT_LOOP, 700);
  const statuses = DOCUMENTS.map((_, index) => documentStatus(index, tick));
  const approved = statuses.filter((status) => status === "approved").length;
  const remaining = DOCUMENTS.length - approved;

  return (
    <Mock ref={ref} className={className}>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <FileCheck2 className="size-4 text-primary" />
        Votre dossier
      </p>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
        <div
          style={{ width: `${(approved / DOCUMENTS.length) * 100}%` }}
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
        />
      </div>
      <ul className="mt-3 grid gap-2.5">
        {DOCUMENTS.map((label, index) => (
          <li key={label} className="flex items-center justify-between text-xs">
            <span>{label}</span>
            <DocumentPill status={statuses[index]} />
          </li>
        ))}
      </ul>
      <p
        className={cn(
          "mt-3 flex items-center gap-1.5 border-t pt-3 text-[0.65rem] transition-colors duration-500",
          remaining === 0
            ? "font-medium text-emerald-600 dark:text-emerald-400"
            : "text-muted-foreground",
        )}
      >
        {remaining === 0 && (
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-500 motion-reduce:animate-none" />
        )}
        {remaining === 0
          ? "Boutique visible"
          : `Il reste ${remaining} ${remaining > 1 ? "étapes" : "étape"}`}
      </p>
    </Mock>
  );
}

interface AlertOrder {
  id: number;
  accepted: boolean;
}

const ALERT_LOOP = 6;

export function AlertsMock({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [orders, setOrders] = useState<AlertOrder[]>([
    { id: 1041, accepted: true },
    { id: 1040, accepted: true },
  ]);
  const [ringing, setRinging] = useState(false);

  useLoopingTick(ref, ALERT_LOOP, 800, (tick) => {
    if (tick === 1) {
      setOrders((list) => [{ id: list[0].id + 1, accepted: false }, ...list].slice(0, 3));
      setRinging(true);
    } else if (tick === 3) {
      setRinging(false);
    } else if (tick === 4) {
      setOrders((list) =>
        list.map((order, index) => (index === 0 ? { ...order, accepted: true } : order)),
      );
    }
  });

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn("grid h-52 w-full max-w-xs content-start gap-2 select-none", className)}
    >
      <div className="flex items-center justify-between px-1 text-[0.65rem] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Bell
            className={cn(
              "size-3.5",
              ringing && "animate-[bell-ring_0.8s_ease-in-out] motion-reduce:animate-none",
            )}
          />
          Commandes
        </span>
        <span
          className={cn(
            "flex items-center gap-1 transition-opacity duration-300",
            ringing ? "opacity-100" : "opacity-40",
          )}
        >
          <Volume2 className="size-3.5" />
          Son · Vibration
        </span>
      </div>
      {orders.map(({ id, accepted }, index) => (
        <div
          key={id}
          className={cn(
            "flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 shadow-sm transition-opacity duration-500",
            index === 0 &&
              ringing &&
              "animate-[card-shake_0.4s_ease-in-out] motion-reduce:animate-none",
            index > 0 && "opacity-70",
            index === 0 &&
              id !== 1041 &&
              "animate-in duration-500 fade-in slide-in-from-top-6 motion-reduce:animate-none",
          )}
        >
          <span className="relative flex size-2 shrink-0">
            {!accepted && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
            )}
            <span
              className={cn(
                "relative inline-flex size-2 rounded-full",
                accepted ? "bg-muted-foreground" : "bg-primary",
              )}
            />
          </span>
          <div className="grid flex-1 leading-tight">
            <span className="text-xs font-medium">
              {accepted ? `Commande #${id}` : `Nouvelle commande #${id}`}
            </span>
            <span className="text-[0.65rem] text-muted-foreground">
              {accepted ? "Acceptée" : "120 $ · à l’instant"}
            </span>
          </div>
          {!accepted && (
            <span className="rounded-md bg-primary px-2 py-1 text-[0.65rem] font-medium text-primary-foreground">
              Accepter
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

const RIDER_PERMISSIONS = [
  { label: "Voir les commandes prêtes à livrer", detail: "Uniquement celles de votre boutique" },
  { label: "Recevoir vos demandes de livraison", detail: "Montant confirmé avant le départ" },
  { label: "Partager sa position", detail: "Pendant les livraisons seulement" },
] as const;

export function RiderRequestMock({ className }: { className?: string }) {
  return (
    <Mock className={className}>
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-muted text-sm font-semibold">
          P
        </span>
        <div className="grid leading-tight">
          <span className="text-sm font-semibold">Patrick M. veut livrer pour vous</span>
          <span className="text-[0.65rem] text-muted-foreground">
            Livreur vérifié · Moto · Dossier approuvé
          </span>
        </div>
      </div>
      <p className="mt-4 text-[0.65rem] font-medium text-muted-foreground">
        Ce que cela lui permet
      </p>
      <ul className="mt-2 grid gap-2.5">
        {RIDER_PERMISSIONS.map(({ label, detail }) => (
          <li key={label} className="flex items-start gap-2.5">
            <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <div className="grid leading-tight">
              <span className="text-xs font-medium">{label}</span>
              <span className="text-[0.65rem] text-muted-foreground">{detail}</span>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs font-medium">
        <span className="rounded-md border py-1.5">Refuser</span>
        <span className="rounded-md bg-primary py-1.5 text-primary-foreground">Accepter</span>
      </div>
      <p className="mt-3 text-center text-[0.65rem] text-muted-foreground">
        Vous pouvez retirer ce livreur de votre boutique à tout moment.
      </p>
    </Mock>
  );
}
