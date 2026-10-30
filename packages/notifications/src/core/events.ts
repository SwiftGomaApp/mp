import type { Role } from "swiftgoma-mp-auth";
import type { Channel, Context, Priority } from "./constants";

export const EVENT_TYPES = [
  "security.alert",
  "security.recovery",
  "security.login.new",
  "account.welcome",
  "order.placed",
  "order.payment.confirmed",
  "order.payment.failed",
  "order.accepted",
  "order.rejected",
  "order.out_for_delivery",
  "order.delivered",
  "order.cancelled",
  "order.refunded",
  "sale.order.new",
  "sale.order.cancelled",
  "sale.stock.low",
  "sale.payout.sent",
  "sale.dispute.opened",
  "delivery.assignment.new",
  "delivery.assignment.cancelled",
  "delivery.pickup.ready",
  "delivery.issue.reported",
  "delivery.payout.sent",
  "support.ticket.assigned",
  "support.ticket.reply",
  "support.sla.breaching",
  "admin.alert.system",
  "admin.seller.pending",
  "admin.dispute.high",
  "announcement.platform",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface Escalation {
  afterMinutes: number;
  channel: "SMS";
}

export interface EventInfo {
  context: Context;
  priority: Priority;
  /** Mandatory events ignore the person's preferences. */
  mandatory: boolean;
  /** The only roles that receive it, or null when every role does. */
  roles: readonly Role[] | null;
  channels: readonly Channel[];
  /** When still unread after this delay, the server also sends an SMS. */
  escalation: Escalation | null;
}

interface EventOptions {
  mandatory?: boolean;
  roles?: readonly Role[];
  channels?: readonly Channel[];
  escalation?: Escalation;
}

const IN_APP_AND_PUSH: readonly Channel[] = ["IN_APP", "PUSH"];
const EVERY_CHANNEL: readonly Channel[] = ["IN_APP", "PUSH", "EMAIL", "SMS"];

function event(context: Context, priority: Priority, options: EventOptions = {}): EventInfo {
  return {
    context,
    priority,
    mandatory: options.mandatory ?? false,
    roles: options.roles ?? null,
    channels: options.channels ?? IN_APP_AND_PUSH,
    escalation: options.escalation ?? null,
  };
}

const security = { mandatory: true, channels: EVERY_CHANNEL };

export const EVENT_CATALOG: Record<EventType, EventInfo> = {
  "security.alert": event("SECURITY", "HIGH", security),
  "security.recovery": event("SECURITY", "HIGH", security),
  "security.login.new": event("SECURITY", "HIGH", security),
  "account.welcome": event("ANNOUNCEMENT", "NORMAL", { channels: EVERY_CHANNEL }),

  "order.placed": event("PURCHASE", "NORMAL"),
  "order.payment.confirmed": event("PURCHASE", "NORMAL"),
  "order.payment.failed": event("PURCHASE", "HIGH"),
  "order.accepted": event("PURCHASE", "NORMAL"),
  "order.rejected": event("PURCHASE", "HIGH"),
  "order.out_for_delivery": event("PURCHASE", "HIGH"),
  "order.delivered": event("PURCHASE", "NORMAL"),
  "order.cancelled": event("PURCHASE", "NORMAL"),
  "order.refunded": event("PURCHASE", "NORMAL"),

  "sale.order.new": event("SALE", "CRITICAL", {
    roles: ["SELLER"],
    escalation: { afterMinutes: 5, channel: "SMS" },
  }),
  "sale.order.cancelled": event("SALE", "HIGH", { roles: ["SELLER"] }),
  "sale.stock.low": event("SALE", "NORMAL", { roles: ["SELLER"] }),
  "sale.payout.sent": event("SALE", "NORMAL", { roles: ["SELLER"] }),
  "sale.dispute.opened": event("SALE", "HIGH", { roles: ["SELLER"] }),

  "delivery.assignment.new": event("DELIVERY", "CRITICAL", {
    mandatory: true,
    roles: ["RIDER"],
    escalation: { afterMinutes: 2, channel: "SMS" },
  }),
  "delivery.assignment.cancelled": event("DELIVERY", "HIGH", { mandatory: true, roles: ["RIDER"] }),
  "delivery.pickup.ready": event("DELIVERY", "HIGH", { roles: ["RIDER"] }),
  "delivery.issue.reported": event("DELIVERY", "HIGH", { roles: ["RIDER"] }),
  "delivery.payout.sent": event("DELIVERY", "NORMAL", { roles: ["RIDER"] }),

  "support.ticket.assigned": event("SUPPORT", "HIGH", { roles: ["SUPPORT"] }),
  "support.ticket.reply": event("SUPPORT", "NORMAL", { roles: ["SUPPORT"] }),
  "support.sla.breaching": event("SUPPORT", "CRITICAL", { roles: ["SUPPORT"] }),

  "admin.alert.system": event("ADMIN", "HIGH", { mandatory: true, roles: ["ADMIN"] }),
  "admin.seller.pending": event("ADMIN", "NORMAL", { roles: ["ADMIN"] }),
  "admin.dispute.high": event("ADMIN", "HIGH", { roles: ["ADMIN"] }),

  "announcement.platform": event("ANNOUNCEMENT", "NORMAL"),
};

export function isEventType(value: unknown): value is EventType {
  return typeof value === "string" && (EVENT_TYPES as readonly string[]).includes(value);
}
