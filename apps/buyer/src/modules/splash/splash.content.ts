export type ConnectionErrorStatus = "offline" | "server-unreachable";

export const SPLASH_TAGLINE = "Application Acheteur";
export const RETRY_LABEL = "Réessayer";

export const CONNECTION_ERRORS = {
  offline: {
    icon: { ios: "wifi.slash", android: "wifi_off", web: "wifi_off" },
    title: "Pas de connexion internet",
    hint: "Vérifiez votre Wi-Fi ou vos données mobiles, puis réessayez.",
  },
  "server-unreachable": {
    icon: { ios: "icloud.slash", android: "cloud_off", web: "cloud_off" },
    title: "Serveur injoignable",
    hint: "SwiftGoma ne répond pas pour le moment. Réessayez dans un instant.",
  },
} as const;

export const WELCOME_CONTENT = {
  title: "Le marché de Goma, dans votre poche",
  description:
    "Découvrez les boutiques près de chez vous, payez avec Mobile Money et recevez votre commande en toute sécurité grâce au code QR.",
  start: "Commencer",
} as const;
