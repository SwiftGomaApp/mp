import { PreferencesView } from "@/components/notifications/preferences-view";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Préférences de notification",
  description: "Choisissez comment et quand SwiftGoma vous prévient.",
  path: "/notifications/settings",
  index: false,
});

export const instant = false;

export default function NotificationSettingsPage() {
  return <PreferencesView />;
}
