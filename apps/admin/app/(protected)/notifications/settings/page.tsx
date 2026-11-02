"use client";

import { useState } from "react";
import { usePreferences } from "swiftgoma-mp-notifications/react";

import { Card, Checkbox, ErrorBanner, Notice, PageHeader, Spinner } from "@/components/ui";

export default function NotificationSettingsPage() {
  const prefs = usePreferences();
  const [error, setError] = useState<unknown>(null);

  async function guard(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <>
      <PageHeader title="Préférences de notification" description="Canaux par catégorie et heures de silence." />
      <ErrorBanner error={error ?? (prefs.status === "error" ? prefs.error : null)} />
      {prefs.status === "loading" && <Spinner />}
      {prefs.preferences && (
        <div className="grid gap-4">
          <Card title="Canaux">
            <div className="grid gap-4">
              {prefs.preferences.categories.map((category) => (
                <div key={category.context}>
                  <p className="text-sm font-medium">{category.label}</p>
                  <div className="mt-1 flex flex-wrap gap-4">
                    {category.channels.map((channel) => (
                      <label
                        key={channel.channel}
                        className="flex items-center gap-2 text-sm"
                        title={channel.locked ? "Obligatoire : ne peut pas être désactivé" : undefined}
                      >
                        <input
                          type="checkbox"
                          checked={channel.enabled}
                          disabled={channel.locked}
                          onChange={(e) =>
                            guard(() =>
                              prefs.update([
                                {
                                  context: category.context,
                                  channel: channel.channel as never,
                                  enabled: e.target.checked,
                                },
                              ]),
                            )
                          }
                        />
                        {channel.channel}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Réglages">
            <div className="grid gap-3">
              <Checkbox
                label="Heures de silence"
                checked={prefs.preferences.settings.quietHoursEnabled}
                onChange={(enabled) => guard(() => prefs.updateSettings({ quietHoursEnabled: enabled }))}
              />
              <Notice>Fuseau horaire : {prefs.preferences.settings.timezone}</Notice>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
