import {
  Bike,
  LifeBuoy,
  Megaphone,
  ShieldCheck,
  ShoppingBag,
  Store,
  Tag,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import type { NotificationItem } from "swiftgoma-mp-notifications";

export type NotificationContext = NotificationItem["context"];

export const CONTEXT_META: Record<NotificationContext, { label: string; icon: LucideIcon }> = {
  SECURITY: { label: "Sécurité", icon: ShieldCheck },
  PURCHASE: { label: "Achats", icon: ShoppingBag },
  SALE: { label: "Ventes", icon: Store },
  DELIVERY: { label: "Livraisons", icon: Bike },
  SUPPORT: { label: "Support", icon: LifeBuoy },
  ADMIN: { label: "Administration", icon: UserCog },
  ANNOUNCEMENT: { label: "Annonces", icon: Megaphone },
  MARKETING: { label: "Offres", icon: Tag },
};
