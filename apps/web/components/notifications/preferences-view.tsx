"use client";

import { useState } from "react";
import { BellRing, Check, Lock, Moon, Smartphone } from "lucide-react";
import { ApiError } from "swiftgoma-mp-auth";
import { usePreferences } from "swiftgoma-mp-notifications/react";
import type {
  NotificationSettings,
  PreferenceCategory,
  PreferenceChannel,
  SettingsPatch,
} from "swiftgoma-mp-notifications";

import { CONTEXT_META } from "@/components/notifications/notification-meta";
import { ErrorText } from "@/components/security/recovery-codes-step";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { authErrorMessage } from "@/lib/auth-errors";
import { cn } from "cn";

const CHANNEL_LABELS: Record<PreferenceChannel, string> = {
  PUSH: "Push",
  SMS: "SMS",
  EMAIL: "E-mail",
};

const DEFAULT_QUIET_START = 22 * 60;
const DEFAULT_QUIET_END = 7 * 60;

const toTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "PREFERENCE_LOCKED") return "Ce réglage ne peut pas être changé.";
    if (error.code === "INVALID_QUIET_HOURS") {
      return "L’heure de début et l’heure de fin doivent être différentes.";
    }
  }
  return authErrorMessage(error);
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div className="grid gap-0.5">
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function CategoryCard({
  category,
  pending,
  onToggle,
}: {
  category: PreferenceCategory;
  pending: Set<string>;
  onToggle: (category: PreferenceCategory, channel: PreferenceChannel, enabled: boolean) => void;
}) {
  const meta = CONTEXT_META[category.context];
  const Icon = meta?.icon ?? BellRing;
  const channels = category.channels.filter(
    (item): item is typeof item & { channel: PreferenceChannel } => item.channel !== "IN_APP",
  );

  return (
    <li className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <div className="grid min-w-0 gap-0.5">
          <p className="flex items-center gap-2 text-sm font-medium">
            {category.label}
            {category.locked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                <Lock className="size-3" />
                Obligatoire
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {category.locked
              ? "Ces alertes protègent votre compte : elles sont toujours envoyées."
              : category.hasMandatory
                ? "Certaines alertes importantes sont toujours envoyées, quels que soient vos réglages."
                : "Choisissez comment être prévenu."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {channels.map(({ channel, enabled, locked }) => {
          const key = `${category.context}:${channel}`;
          const disabled = category.locked || locked || pending.has(key);
          return (
            <label
              key={channel}
              className={cn(
                "flex items-center gap-2 text-sm",
                disabled ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer",
              )}
            >
              <Switch
                size="sm"
                checked={enabled}
                disabled={disabled}
                onCheckedChange={(checked) => onToggle(category, channel, checked)}
              />
              {CHANNEL_LABELS[channel]}
            </label>
          );
        })}
      </div>
    </li>
  );
}

function QuietHours({
  settings,
  onSave,
  saving,
}: {
  settings: NotificationSettings;
  onSave: (patch: SettingsPatch) => void;
  saving: boolean;
}) {
  const [start, setStart] = useState(toTime(settings.quietHoursStart ?? DEFAULT_QUIET_START));
  const [end, setEnd] = useState(toTime(settings.quietHoursEnd ?? DEFAULT_QUIET_END));

  const changed =
    toMinutes(start) !== (settings.quietHoursStart ?? DEFAULT_QUIET_START) ||
    toMinutes(end) !== (settings.quietHoursEnd ?? DEFAULT_QUIET_END);

  return (
    <div className="grid gap-4 rounded-xl border bg-card p-4">
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <span className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Moon className="size-4" />
          </span>
          <span className="grid gap-0.5">
            <span className="text-sm font-medium">Heures de silence</span>
            <span className="text-xs text-muted-foreground">
              Pas de push ni de SMS la nuit. Les alertes de sécurité passent toujours.
            </span>
          </span>
        </span>
        <Switch
          checked={settings.quietHoursEnabled}
          disabled={saving}
          onCheckedChange={(checked) =>
            onSave(
              checked
                ? {
                    quietHoursEnabled: true,
                    quietHoursStart: toMinutes(start),
                    quietHoursEnd: toMinutes(end),
                  }
                : { quietHoursEnabled: false },
            )
          }
        />
      </label>

      {settings.quietHoursEnabled && (
        <div className="flex flex-wrap items-end gap-4 border-t pt-4">
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">De</span>
            <Input
              type="time"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              disabled={saving}
              className="w-32"
              required
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">À</span>
            <Input
              type="time"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              disabled={saving}
              className="w-32"
              required
            />
          </label>
          <Button
            size="sm"
            disabled={!changed || saving || !start || !end}
            onClick={() =>
              onSave({
                quietHoursEnabled: true,
                quietHoursStart: toMinutes(start),
                quietHoursEnd: toMinutes(end),
              })
            }
          >
            {saving && <Spinner data-icon="inline-start" />}
            Enregistrer
          </Button>
        </div>
      )}
    </div>
  );
}

export function PreferencesView() {
  const { status, preferences, reload, update, updateSettings } = usePreferences();
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(
    category: PreferenceCategory,
    channel: PreferenceChannel,
    enabled: boolean,
  ) {
    const key = `${category.context}:${channel}`;
    setError(null);
    setPending((current) => new Set(current).add(key));
    try {
      await update([{ context: category.context, channel, enabled }]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }

  async function saveSettings(patch: SettingsPatch) {
    setError(null);
    setSavingSettings(true);
    try {
      await updateSettings(patch);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingSettings(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    );
  }

  if (status === "error" || !preferences) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <ErrorText>Impossible de charger vos préférences.</ErrorText>
        <Button size="sm" variant="outline" onClick={() => reload()}>
          Réessayer
        </Button>
      </div>
    );
  }

  const { categories, settings } = preferences;
  const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="grid gap-8">
      {error && <ErrorText>{error}</ErrorText>}

      <Section
        title="Canaux par catégorie"
        description="Pour chaque type de notification, choisissez où la recevoir. Elles restent toujours visibles dans votre boîte."
      >
        <p className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <Smartphone className="mt-0.5 size-4 shrink-0" />
          Les notifications push arrivent sur l’application mobile SwiftGoma.
        </p>
        <ul className="grid gap-2">
          {categories.map((category) => (
            <CategoryCard
              key={category.context}
              category={category}
              pending={pending}
              onToggle={toggle}
            />
          ))}
        </ul>
      </Section>

      <Section title="Heures de silence">
        <QuietHours
          key={`${settings.quietHoursEnabled}-${settings.quietHoursStart}-${settings.quietHoursEnd}`}
          settings={settings}
          saving={savingSettings}
          onSave={saveSettings}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground">
            Fuseau horaire : <span className="text-foreground">{settings.timezone}</span>
          </p>
          {deviceTimezone && deviceTimezone !== settings.timezone ? (
            <Button
              size="sm"
              variant="outline"
              disabled={savingSettings}
              onClick={() => saveSettings({ timezone: deviceTimezone })}
            >
              Utiliser {deviceTimezone}
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Check className="size-3.5" />
              Identique à cet appareil
            </span>
          )}
        </div>
      </Section>

      <Section title="Offres et nouveautés">
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border bg-card p-4">
          <span className="grid gap-0.5">
            <span className="text-sm font-medium">Recevoir des offres par e-mail</span>
            <span className="text-xs text-muted-foreground">
              Promotions et nouveautés de SwiftGoma. Vous pouvez vous désabonner à tout moment.
            </span>
          </span>
          <Switch
            checked={settings.marketingEmailOptIn}
            disabled={savingSettings}
            onCheckedChange={(checked) => saveSettings({ marketingEmailOptIn: checked })}
          />
        </label>
      </Section>
    </div>
  );
}
