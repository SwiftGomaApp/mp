import { legalConfig } from "@/lib/legal/config";
import type { LegalDocument } from "@/lib/legal/types";

const email = `[${legalConfig.supportEmail}](mailto:${legalConfig.supportEmail})`;

export const cookies: LegalDocument = {
  slug: "cookies",
  title: "Politique relative aux cookies",
  shortTitle: "Cookies",
  description:
    "Les cookies et les stockages locaux utilisés par le site SwiftGoma : uniquement ceux qui sont nécessaires à votre connexion et à vos préférences.",
  lastUpdated: legalConfig.lastUpdated,
  version: legalConfig.version,
  intro:
    "Cette page explique ce que le site SwiftGoma enregistre dans votre navigateur. Aujourd’hui, nous n’utilisons que ce qui est nécessaire pour que vous puissiez vous connecter et retrouver vos préférences.",
  sections: [
    {
      id: "definition",
      title: "Ce qu’est un cookie",
      blocks: [
        "Un cookie est un petit fichier enregistré dans votre navigateur quand vous visitez un site. Il permet au site de se souvenir de quelque chose, par exemple que vous êtes connecté. Le navigateur peut aussi garder de petites informations dans son « stockage local », qui joue un rôle semblable.",
      ],
    },
    {
      id: "cookies-utilises",
      title: "Les cookies que nous utilisons",
      blocks: [
        "Ces deux cookies servent uniquement à vous garder connecté. Ils sont indispensables : sans eux, vous ne pourriez pas vous connecter sur le site. Ils ne sont pas utilisés pour la publicité ni pour vous suivre sur d’autres sites.",
        {
          table: {
            head: ["Nom", "À quoi il sert", "Durée"],
            rows: [
              [
                "`__Host-swg_access`",
                "Prouve que vous êtes connecté, pour que le site accepte vos actions.",
                "Environ 15 minutes, puis renouvelé tant que vous restez actif",
              ],
              [
                "`swg_refresh`",
                "Permet de renouveler votre connexion sans vous redemander vos informations.",
                "Jusqu’à 7 jours ; supprimé à la déconnexion",
              ],
            ],
          },
        },
        "Ces cookies sont « HttpOnly » : le code de la page ne peut pas les lire, ce qui les protège contre le vol. Ils sont envoyés uniquement en connexion sécurisée (HTTPS) et ne sont pas transmis à des sites tiers.",
      ],
    },
    {
      id: "stockage-local",
      title: "Le stockage local de votre navigateur",
      blocks: [
        {
          table: {
            head: ["Information", "À quoi elle sert", "Durée"],
            rows: [
              [
                "Thème (clair, sombre ou comme l’appareil)",
                "Retrouver l’apparence que vous avez choisie.",
                "Jusqu’à ce que vous l’effaciez",
              ],
              [
                "Contact en cours de vérification",
                "Se souvenir de votre adresse ou de votre numéro entre l’écran de saisie et l’écran du code, sans les mettre dans l’adresse de la page.",
                "Le temps de la session ; effacé à la fin de la vérification",
              ],
              [
                "Délai avant de pouvoir renvoyer un code",
                "Garder le décompte de 60 secondes si vous actualisez la page.",
                "Le temps de la session",
              ],
            ],
          },
        },
      ],
    },
    {
      id: "services-tiers",
      title: "Les services de tiers",
      blocks: [
        "Si vous choisissez de vous connecter ou de vous inscrire avec Google, le site charge un script de Google. Google peut alors enregistrer ses propres cookies ou informations, selon sa propre politique. Rien n’est chargé depuis Google si vous n’utilisez pas ce bouton.",
        "Nous n’utilisons pas de cookies publicitaires ni d’outil de mesure d’audience qui vous suit d’un site à l’autre. Si cela change un jour, nous mettrons cette page à jour et nous demanderons votre accord avant d’utiliser ces cookies.",
      ],
    },
    {
      id: "controle",
      title: "Comment les contrôler",
      blocks: [
        "Vous pouvez supprimer les cookies et le stockage local depuis les réglages de votre navigateur, ou configurer celui-ci pour les bloquer. Si vous bloquez les cookies nécessaires, vous ne pourrez plus rester connecté sur le site.",
        "Vous pouvez aussi vous déconnecter à tout moment depuis l’application : les cookies de connexion sont alors supprimés. Pour fermer vos connexions sur tous vos appareils, utilisez l’écran « Appareils connectés » dans la sécurité de votre compte.",
      ],
    },
    {
      id: "modifications",
      title: "Modifications et contact",
      blocks: [
        "Nous mettons cette page à jour si nous changeons les cookies utilisés. Pour savoir comment nous traitons vos informations, consultez la [politique de confidentialité](/legale/privacy).",
        `Une question ? Écrivez-nous à ${email}.`,
      ],
    },
  ],
};
