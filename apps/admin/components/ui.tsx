"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";

import { Button as BrandButton } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input as BrandInput } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner as BrandSpinner } from "@/components/ui/spinner";
import { Textarea as BrandTextarea } from "@/components/ui/textarea";

import { describeError } from "@/lib/errors";
import type { ErrorInfo } from "@/lib/errors";

export { cn } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

// ------------------------------------------------------------------ buttons and fields
type Variant = "primary" | "outline" | "danger" | "ghost";

const VARIANT_MAP = {
  primary: "default",
  outline: "outline",
  danger: "destructive",
  ghost: "ghost",
} as const;

export function Button({
  variant = "primary",
  size = "md",
  loading,
  children,
  disabled,
  type = "button",
  ...props
}: Omit<React.ComponentProps<typeof BrandButton>, "variant" | "size"> & {
  variant?: Variant;
  size?: "sm" | "md";
  loading?: boolean;
}) {
  return (
    <BrandButton
      type={type}
      variant={VARIANT_MAP[variant]}
      size={size === "sm" ? "sm" : "default"}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <BrandSpinner data-icon="inline-start" />}
      {children}
    </BrandButton>
  );
}

export { BrandInput as Input, BrandTextarea as Textarea };

export function Select({ className, ...props }: React.ComponentProps<typeof NativeSelect>) {
  return <NativeSelect className={cn("w-full", className)} {...props} />;
}

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" className="accent-primary" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && !error && <span className="text-xs text-muted-foreground">{hint}</span>}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </label>
  );
}

// ------------------------------------------------------------------ layout bits
export function Card({
  title,
  actions,
  children,
  className,
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-border bg-card", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

const tones = {
  neutral: "bg-muted text-foreground",
  good: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  warn: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  bad: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  info: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
};

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, keyof typeof tones> = {
  ACTIVE: "good",
  APPROVED: "good",
  REACHED: "good",
  RECOMMEND_APPROVE: "good",
  PENDING: "warn",
  PENDING_APPROVAL: "warn",
  PENDING_DELETION: "warn",
  IN_REVIEW: "info",
  SUSPENDED: "warn",
  EXPIRED: "warn",
  NO_ANSWER: "warn",
  BANNED: "bad",
  DELETED: "bad",
  REJECTED: "bad",
  REFUSED: "bad",
  WRONG_NUMBER: "bad",
  RECOMMEND_REJECT: "bad",
};

export function StatusBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return <Badge tone={STATUS_TONE[value] ?? "neutral"}>{value}</Badge>;
}

export function Spinner({ className }: { className?: string }) {
  return <BrandSpinner className={cn("size-5 text-muted-foreground", className)} />;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{children}</p>;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "good" | "warn"; children: ReactNode }) {
  const t = { info: tones.info, good: tones.good, warn: tones.warn }[tone];
  return <p className={cn("rounded-md px-3 py-2 text-sm", t)}>{children}</p>;
}

// ------------------------------------------------------------------ errors
/** Shows the server error shape: message, code, request id and field details. */
export function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null;
  const info: ErrorInfo = describeError(error);
  const fields = info.fields ? Object.entries(info.fields) : [];
  const details =
    !fields.length && info.details && typeof info.details === "object"
      ? JSON.stringify(info.details)
      : null;
  return (
    <div
      role="alert"
      className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <div className="grid gap-1">
        <p className="font-medium">{info.message}</p>
        {fields.length > 0 && (
          <ul className="list-disc pl-4 text-xs">
            {fields.map(([field, message]) => (
              <li key={field}>
                {field} : {message}
              </li>
            ))}
          </ul>
        )}
        {details && <p className="font-mono text-xs break-all opacity-80">{details}</p>}
        {(info.code || info.requestId) && (
          <p className="font-mono text-[11px] opacity-70">
            {info.code}
            {info.code && info.requestId ? " · " : ""}
            {info.requestId && `requête ${info.requestId}`}
          </p>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ data loading
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]) {
  const [tick, setTick] = useState(0);
  const [result, setResult] = useState<{ key: string; data: T | null; error: unknown } | null>(
    null,
  );
  const key = `${JSON.stringify(deps)}#${tick}`;

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => !cancelled && setResult({ key, data, error: null }))
      .catch((error: unknown) => !cancelled && setResult({ key, data: null, error }));
    return () => {
      cancelled = true;
    };
    // `load` is a fresh closure on every render; `key` stands for the values it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  const current = result?.key === key;
  return {
    data: result?.data ?? null,
    error: current ? result.error : null,
    loading: !current,
    reload,
  };
}

export function Pager({
  page,
  limit,
  total,
  onPage,
}: {
  page: number;
  limit: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="flex items-center justify-between gap-3 pt-4 text-sm text-muted-foreground">
      <span>
        {total} résultat{total > 1 ? "s" : ""} · page {page}/{pages}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Précédent
        </Button>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Suivant
        </Button>
      </div>
    </div>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}
export const Th = ({ children }: { children?: ReactNode }) => (
  <th className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground uppercase">
    {children}
  </th>
);
export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <td className={cn("border-b border-border px-3 py-2.5 align-top", className)}>{children}</td>
);

// ------------------------------------------------------------------ dialogs
export function Modal({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] gap-5 overflow-y-auto p-7 sm:max-w-md">
        <DialogHeader className="gap-1">
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          {description && <DialogDescription className="text-xs">{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/**
 * A form in a dialog: runs `onSubmit`, shows the server error and closes on success.
 * Children are the fields; the submit button is disabled until `canSubmit`.
 */
export function FormDialog({
  open,
  title,
  description,
  submitLabel,
  danger,
  canSubmit = true,
  onClose,
  onSubmit,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  submitLabel: string;
  danger?: boolean;
  canSubmit?: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  function close() {
    setError(null);
    onClose();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit();
      close();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title={title} description={description} onClose={() => !busy && close()}>
      <form onSubmit={submit} className="grid gap-4">
        {children}
        <ErrorBanner error={error} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={close} disabled={busy}>
            Annuler
          </Button>
          <Button type="submit" variant={danger ? "danger" : "primary"} loading={busy} disabled={!canSubmit}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
