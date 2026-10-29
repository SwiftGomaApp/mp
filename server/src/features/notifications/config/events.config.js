const { securityAlertInfo } = require("../../../core/messaging/securityAlert");

const SECURITY_CHANNELS = ["IN_APP", "PUSH", "EMAIL", "SMS"];

const ROLE_ACTIONS = {
  SELLER: "Envoyez vos documents pour activer votre boutique",
  RIDER: "Envoyez vos documents pour pouvoir livrer",
};
const DEFAULT_ACTION = "Découvrez les boutiques de Goma et commandez";

const orderKey = (name) => (d) => `${name}:${d.orderId}`;

function define(key, config) {
  return [
    key,
    {
      key,
      priority: "NORMAL",
      mandatory: false,
      channels: ["IN_APP", "PUSH"],
      required: [],
      ttlDays: 90,
      ...config,
    },
  ];
}

const securityAlert = (overrides = {}) => ({
  context: "SECURITY",
  priority: "HIGH",
  mandatory: true,
  channels: SECURITY_CHANNELS,
  smsFallbackOnly: true,
  required: ["type"],
  email: "securityAlert",
  sms: "securityAlert",
  render: (d) => ({ title: "Alerte de sécurité", body: `${securityAlertInfo(d.type).title}.` }),
  pushText: () => ({
    title: "Alerte de sécurité",
    body: "Un changement a été effectué sur votre compte.",
  }),
  ...overrides,
});

const EVENTS = Object.freeze(
  Object.fromEntries([
    define("security.alert", securityAlert()),
    define("security.recovery", securityAlert({ smsFallbackOnly: false })),
    define("security.login.new", {
      context: "SECURITY",
      priority: "HIGH",
      mandatory: true,
      channels: SECURITY_CHANNELS,
      smsFallbackOnly: true,
      required: ["deviceName", "location"],
      email: "loginAlert",
      sms: "loginAlert",
      render: (d) => ({
        title: "Nouvelle connexion",
        body: `Connexion depuis ${d.deviceName} (${d.location}). Si ce n'est pas vous, sécurisez votre compte.`,
      }),
      pushText: () => ({
        title: "Nouvelle connexion",
        body: "Une connexion à votre compte a été détectée.",
      }),
    }),

    // ---- account lifecycle ----
    define("account.welcome", {
      context: "ANNOUNCEMENT",
      channels: ["IN_APP", "PUSH", "EMAIL", "SMS"],
      smsFallbackOnly: true,
      required: ["role"],
      dedupe: () => "account.welcome",
      email: "welcome",
      sms: "welcome",
      render: (d) => ({
        title: "Bienvenue sur SwiftGoma !",
        body: `${ROLE_ACTIONS[d.role] ?? DEFAULT_ACTION} dans l'application.`,
      }),
    }),

    // ---- purchases (any role acting as a buyer) ----
    define("order.placed", {
      context: "PURCHASE",
      required: ["orderId", "orderNumber", "shopName"],
      dedupe: orderKey("order.placed"),
      render: (d) => ({
        title: "Commande envoyée",
        body: `Votre commande ${d.orderNumber} a été envoyée à ${d.shopName}.`,
      }),
    }),
    define("order.payment.confirmed", {
      context: "PURCHASE",
      required: ["orderId", "orderNumber"],
      dedupe: orderKey("order.payment.confirmed"),
      render: (d) => ({
        title: "Paiement confirmé",
        body: `Nous avons bien reçu le paiement de votre commande ${d.orderNumber}.`,
      }),
    }),
    define("order.payment.failed", {
      context: "PURCHASE",
      priority: "HIGH",
      required: ["orderId", "orderNumber"],
      dedupe: orderKey("order.payment.failed"),
      render: (d) => ({
        title: "Paiement échoué",
        body: `Le paiement de votre commande ${d.orderNumber} n'a pas abouti. Vous pouvez réessayer.`,
      }),
    }),
    define("order.accepted", {
      context: "PURCHASE",
      required: ["orderId", "orderNumber", "shopName"],
      dedupe: orderKey("order.accepted"),
      render: (d) => ({
        title: "Commande acceptée",
        body: `${d.shopName} prépare votre commande ${d.orderNumber}.`,
      }),
    }),
    define("order.rejected", {
      context: "PURCHASE",
      priority: "HIGH",
      required: ["orderId", "orderNumber", "shopName"],
      dedupe: orderKey("order.rejected"),
      render: (d) => ({
        title: "Commande refusée",
        body: `Votre commande ${d.orderNumber} n'a pas été acceptée par ${d.shopName}.`,
      }),
    }),
    define("order.out_for_delivery", {
      context: "PURCHASE",
      priority: "HIGH",
      required: ["orderId", "orderNumber"],
      dedupe: orderKey("order.out_for_delivery"),
      render: (d) => ({
        title: "Votre livreur est en route",
        body: `Votre commande ${d.orderNumber} est en route.`,
      }),
    }),
    define("order.delivered", {
      context: "PURCHASE",
      required: ["orderId", "orderNumber"],
      dedupe: orderKey("order.delivered"),
      render: (d) => ({
        title: "Commande livrée",
        body: `Votre commande ${d.orderNumber} a été livrée. Merci d'avoir choisi SwiftGoma !`,
      }),
    }),
    define("order.cancelled", {
      context: "PURCHASE",
      required: ["orderId", "orderNumber"],
      dedupe: orderKey("order.cancelled"),
      render: (d) => ({
        title: "Commande annulée",
        body: `La commande ${d.orderNumber} a été annulée.`,
      }),
    }),
    define("order.refunded", {
      context: "PURCHASE",
      required: ["orderId", "orderNumber"],
      dedupe: orderKey("order.refunded"),
      render: (d) => ({
        title: "Remboursement effectué",
        body: `Votre remboursement pour la commande ${d.orderNumber} a été effectué.`,
      }),
    }),

    // ---- seller ----
    define("sale.order.new", {
      context: "SALE",
      roles: ["SELLER"],
      priority: "CRITICAL",
      escalation: { afterMinutes: 5, channel: "SMS" },
      sms: "generic",
      required: ["orderId", "orderNumber"],
      dedupe: orderKey("sale.order.new"),
      render: (d) => ({
        title: "Nouvelle commande",
        body: `Vous avez reçu la commande ${d.orderNumber}. Acceptez-la rapidement.`,
      }),
    }),
    define("sale.order.cancelled", {
      context: "SALE",
      roles: ["SELLER"],
      priority: "HIGH",
      required: ["orderId", "orderNumber"],
      dedupe: orderKey("sale.order.cancelled"),
      render: (d) => ({
        title: "Commande annulée",
        body: `Le client a annulé la commande ${d.orderNumber}.`,
      }),
    }),
    define("sale.stock.low", {
      context: "SALE",
      roles: ["SELLER"],
      required: ["productId", "productName", "remaining"],
      dedupe: (d) => `sale.stock.low:${d.productId}:${d.remaining}`,
      render: (d) => ({
        title: "Stock faible",
        body: `Il ne reste que ${d.remaining} unité(s) de ${d.productName}.`,
      }),
    }),
    define("sale.payout.sent", {
      context: "SALE",
      roles: ["SELLER"],
      required: ["payoutId", "amount"],
      dedupe: (d) => `sale.payout.sent:${d.payoutId}`,
      render: (d) => ({
        title: "Versement envoyé",
        body: `Un versement de ${d.amount} a été envoyé sur votre compte.`,
      }),
      pushText: () => ({ title: "Versement envoyé", body: "Un versement a été envoyé." }),
    }),
    define("sale.dispute.opened", {
      context: "SALE",
      roles: ["SELLER"],
      priority: "HIGH",
      required: ["disputeId", "orderNumber"],
      dedupe: (d) => `sale.dispute.opened:${d.disputeId}`,
      render: (d) => ({
        title: "Litige ouvert",
        body: `Un litige a été ouvert sur la commande ${d.orderNumber}.`,
      }),
    }),

    // ---- rider ----
    define("delivery.assignment.new", {
      context: "DELIVERY",
      roles: ["RIDER"],
      priority: "CRITICAL",
      mandatory: true,
      escalation: { afterMinutes: 2, channel: "SMS" },
      sms: "generic",
      required: ["deliveryId", "pickupArea"],
      dedupe: (d) => `delivery.assignment.new:${d.deliveryId}`,
      render: (d) => ({
        title: "Nouvelle livraison",
        body: `Course disponible : retrait à ${d.pickupArea}. Acceptez-la maintenant.`,
      }),
    }),
    define("delivery.assignment.cancelled", {
      context: "DELIVERY",
      roles: ["RIDER"],
      priority: "HIGH",
      mandatory: true,
      required: ["deliveryId"],
      dedupe: (d) => `delivery.assignment.cancelled:${d.deliveryId}`,
      render: () => ({
        title: "Livraison annulée",
        body: "Cette livraison ne vous est plus attribuée.",
      }),
    }),
    define("delivery.pickup.ready", {
      context: "DELIVERY",
      roles: ["RIDER"],
      priority: "HIGH",
      required: ["deliveryId", "shopName"],
      dedupe: (d) => `delivery.pickup.ready:${d.deliveryId}`,
      render: (d) => ({
        title: "Commande prête",
        body: `La commande est prête chez ${d.shopName}.`,
      }),
    }),
    define("delivery.issue.reported", {
      context: "DELIVERY",
      roles: ["RIDER"],
      priority: "HIGH",
      required: ["deliveryId"],
      dedupe: (d) => `delivery.issue.reported:${d.deliveryId}`,
      render: () => ({
        title: "Problème signalé",
        body: "Un problème a été signalé sur votre livraison. Ouvrez l'application.",
      }),
    }),
    define("delivery.payout.sent", {
      context: "DELIVERY",
      roles: ["RIDER"],
      required: ["payoutId", "amount"],
      dedupe: (d) => `delivery.payout.sent:${d.payoutId}`,
      render: (d) => ({
        title: "Paiement reçu",
        body: `Un paiement de ${d.amount} a été envoyé sur votre compte.`,
      }),
      pushText: () => ({ title: "Paiement reçu", body: "Un paiement a été envoyé." }),
    }),

    // ---- support ----
    define("support.ticket.assigned", {
      context: "SUPPORT",
      roles: ["SUPPORT"],
      priority: "HIGH",
      required: ["ticketId"],
      dedupe: (d) => `support.ticket.assigned:${d.ticketId}`,
      render: () => ({
        title: "Ticket attribué",
        body: "Un nouveau ticket vous a été attribué.",
      }),
    }),
    define("support.ticket.reply", {
      context: "SUPPORT",
      roles: ["SUPPORT"],
      required: ["ticketId", "replyId"],
      dedupe: (d) => `support.ticket.reply:${d.replyId}`,
      render: () => ({
        title: "Nouvelle réponse",
        body: "Le client a répondu à un de vos tickets.",
      }),
    }),
    define("support.sla.breaching", {
      context: "SUPPORT",
      roles: ["SUPPORT"],
      priority: "CRITICAL",
      required: ["ticketId"],
      dedupe: (d) => `support.sla.breaching:${d.ticketId}`,
      render: () => ({
        title: "Délai de réponse bientôt dépassé",
        body: "Un ticket va dépasser son délai de réponse.",
      }),
    }),

    // ---- admin ----
    define("admin.alert.system", {
      context: "ADMIN",
      roles: ["ADMIN"],
      priority: "HIGH",
      mandatory: true,
      required: ["title", "message"],
      render: (d) => ({ title: d.title, body: d.message }),
      pushText: (d) => ({ title: d.title, body: "Ouvrez la console pour les détails." }),
    }),
    define("admin.seller.pending", {
      context: "ADMIN",
      roles: ["ADMIN"],
      required: ["sellerId", "shopName"],
      dedupe: (d) => `admin.seller.pending:${d.sellerId}`,
      render: (d) => ({
        title: "Vendeur en attente",
        body: `${d.shopName} attend l'approbation de son dossier.`,
      }),
    }),
    define("admin.dispute.high", {
      context: "ADMIN",
      roles: ["ADMIN"],
      priority: "HIGH",
      required: ["disputeId"],
      dedupe: (d) => `admin.dispute.high:${d.disputeId}`,
      render: () => ({
        title: "Litige urgent",
        body: "Un litige de haute gravité a été ouvert.",
      }),
    }),

    // ---- platform announcements ----
    define("announcement.platform", {
      context: "ANNOUNCEMENT",
      required: ["title", "message", "announcementId"],
      dedupe: (d) => `announcement.platform:${d.announcementId}`,
      render: (d) => ({ title: d.title, body: d.message }),
    }),
  ]),
);

function findEvent(key) {
  return EVENTS[key];
}

function getEvent(key) {
  const event = EVENTS[key];
  if (!event) throw new Error(`Unknown notification event: ${key}`);
  return event;
}

module.exports = { EVENTS, findEvent, getEvent };
