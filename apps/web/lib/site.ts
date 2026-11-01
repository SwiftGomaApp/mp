export const siteConfig = {
  name: "SwiftGoma MarketPlace",
  shortName: "SwiftGoma",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  locale: "fr_CD",
  title: "SwiftGoma MarketPlace – La place de marché de Goma",
  description:
    "Découvrez les boutiques de Goma, commandez depuis votre téléphone, payez avec Mobile Money ou carte bancaire, et faites-vous livrer ou retirez en boutique. Paiement sécurisé par code QR.",
  keywords: [
    "SwiftGoma",
    "marketplace Goma",
    "place de marché Goma",
    "boutiques Goma",
    "achat en ligne RDC",
    "livraison Goma",
    "Mobile Money",
    "M-Pesa",
    "Airtel Money",
    "Orange Money",
    "vendre en ligne Goma",
    "devenir livreur Goma",
    "Nord-Kivu",
    "République démocratique du Congo",
  ],
  logo: "/logo-icon.png",
  themeColor: "#c2410c",
  launchYear: 2026,
} as const;

export const contactConfig = {
  phone: "+243 855 078 387",
  phoneHref: "tel:+243855078387",
  whatsappHref: "https://wa.me/243855078387",
} as const;

export const socialLinks = [
  { id: "instagram", label: "Instagram", href: "https://www.instagram.com/swift__goma__/" },
  {
    id: "facebook",
    label: "Facebook",
    href: "https://web.facebook.com/profile.php?id=61593895566555",
  },
  { id: "tiktok", label: "TikTok", href: "https://www.tiktok.com/@sweeftgoma5" },
] as const;
