import { InboxView } from "@/components/notifications/inbox-view";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Notifications",
  description: "Vos notifications SwiftGoma : commandes, paiements, livraisons et sécurité.",
  path: "/notifications",
  index: false,
});

export const instant = false;

export default function NotificationsPage() {
  return <InboxView />;
}
