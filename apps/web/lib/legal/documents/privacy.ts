import { legalConfig } from "@/lib/legal/config";
import type { LegalDocument } from "@/lib/legal/types";

const email = `[${legalConfig.supportEmail}](mailto:${legalConfig.supportEmail})`;

export const privacy: LegalDocument = {
  slug: "privacy",
  title: "Politique de confidentialité",
  shortTitle: "Confidentialité",
  description:
    "Quelles données SwiftGoma collecte, pourquoi, combien de temps elles sont conservées, avec qui elles sont partagées et comment exercer vos droits.",
  lastUpdated: legalConfig.lastUpdated,
  version: legalConfig.version,
  intro:
    "Cette politique explique quelles informations SwiftGoma collecte quand vous utilisez la place de marché, pourquoi nous en avons besoin, combien de temps nous les gardons et ce que vous pouvez faire pour les contrôler.",
  sections: [
    {
      id: "responsable",
      title: "Qui est responsable de vos données",
      blocks: [
        "SwiftGoma, plateforme exploitée à Goma (Nord-Kivu), en République démocratique du Congo, est responsable du traitement des données décrit dans cette politique.",
        `Pour toute question sur vos données, écrivez-nous à ${email}.`,
      ],
    },
    {
      id: "donnees-collectees",
      title: "Les données que nous collectons",
      blocks: [
        { heading: "Votre compte" },
        {
          list: [
            "Votre nom, votre adresse e-mail et votre numéro de téléphone.",
            "Votre mot de passe, jamais conservé tel quel : même l’équipe SwiftGoma ne peut pas le lire.",
            "Les méthodes de connexion reliées à votre compte : e-mail, téléphone, Google, mot de passe, empreinte ou visage (clé d’accès), double vérification et codes de secours.",
            "Vos contacts de récupération (e-mail et téléphone), si vous en ajoutez.",
            "Vos préférences : apparence, notifications, économie de données, nom affiché dans les avis, offres et promotions.",
          ],
        },
        { heading: "Vos appareils et votre activité" },
        {
          list: [
            "Pour chaque appareil connecté : son nom, son type et les dates de connexion.",
            "Dans le journal d’activité : la date et l’heure, l’appareil, l’adresse IP, la ville approximative qui en est déduite, la méthode de connexion et le résultat (réussi ou échoué), ainsi que les changements de sécurité.",
            "Le jeton de notification de votre téléphone, pour vous envoyer des notifications.",
          ],
        },
        { heading: "Vos achats" },
        {
          list: [
            "Vos adresses de livraison, vos paniers, vos commandes, vos favoris et vos avis.",
            "Votre position, lorsque vous autorisez l’application à l’utiliser, pour afficher les boutiques proches. Vous pouvez la refuser et choisir une adresse ou un quartier à la main.",
            "Votre numéro Mobile Money et les informations de paiement nécessaires pour traiter votre commande et vos remboursements.",
            "Vos échanges avec le Support et les signalements de problèmes.",
          ],
        },
        { heading: "Si vous êtes vendeur ou livreur" },
        {
          list: [
            "Votre pièce d’identité et un selfie.",
            "Pour un vendeur : le registre de commerce ou l’autorisation d’exploitation, le numéro d’impôt, les photos de la boutique et le numéro Mobile Money de versement, qui doit être au même nom que la pièce d’identité.",
            "Pour un livreur : le permis de conduire, la photo du véhicule et de sa plaque.",
            "Pendant une livraison, votre position en direct, partagée avec l’acheteur et avec la boutique.",
            "L’historique de votre portefeuille : entrées, retraits et commandes concernées.",
          ],
        },
      ],
    },
    {
      id: "finalites",
      title: "Pourquoi nous utilisons vos données",
      blocks: [
        {
          table: {
            head: ["Pourquoi", "Quelles données"],
            rows: [
              [
                "Créer et sécuriser votre compte, vous connecter, envoyer des codes",
                "Contacts, méthodes de connexion, appareils, journal d’activité",
              ],
              [
                "Traiter vos commandes, vos paiements, vos livraisons et vos remboursements",
                "Commandes, adresses, position, paiements, portefeuille",
              ],
              [
                "Vérifier les vendeurs et les livreurs et protéger les acheteurs",
                "Documents d’identité, selfie, documents professionnels",
              ],
              [
                "Prévenir la fraude et les abus, et résoudre les litiges",
                "Journal d’activité, historique des commandes, scans QR, signalements",
              ],
              [
                "Vous envoyer des notifications utiles (commandes, livraisons, sécurité)",
                "Jetons de notification, préférences",
              ],
              [
                "Vous envoyer des offres et promotions, si vous les avez acceptées",
                "Adresse e-mail, préférences commerciales",
              ],
              ["Respecter nos obligations légales et comptables", "Commandes et paiements passés"],
            ],
          },
        },
        "Nous n’utilisons pas vos données pour vous envoyer des offres commerciales si vous ne l’avez pas choisi. Les messages de sécurité restent toujours actifs, car ils protègent votre compte.",
      ],
    },
    {
      id: "partage",
      title: "Avec qui nous partageons vos données",
      blocks: [
        "Nous ne vendons pas vos données. Nous les partageons seulement lorsque c’est nécessaire :",
        {
          list: [
            "**Les autres utilisateurs d’une commande.** Le vendeur voit votre nom, les produits commandés et l’adresse de livraison ; le livreur voit l’adresse de la boutique, la vôtre et le contenu de la commande, et vous voyez sa position pendant la livraison.",
            "**L’équipe SwiftGoma.** Le Support et les Admins ne voient que ce dont ils ont besoin pour leur travail. Les documents d’identité sont gardés en privé, vus seulement par les personnes autorisées, et chaque consultation est notée.",
            "**Nos prestataires techniques.** Ils traitent des données pour notre compte : envoi de SMS (Africa’s Talking), envoi d’e-mails, envoi de notifications sur téléphone (OneSignal), surveillance des erreurs (Sentry), hébergement et stockage, et traitement des paiements Mobile Money.",
            "**Google.** Si vous vous inscrivez ou vous connectez avec votre compte Google, Google nous confirme votre identité.",
            "**Les autorités.** Lorsque la loi nous y oblige.",
          ],
        },
        "Certains de ces prestataires peuvent se trouver hors de la RDC. Dans ce cas, nous ne leur transmettons que les données nécessaires à leur mission.",
      ],
    },
    {
      id: "conservation",
      title: "Combien de temps nous gardons vos données",
      blocks: [
        {
          table: {
            head: ["Donnée", "Durée"],
            rows: [
              ["Inscription non confirmée", "Supprimée après 3 jours"],
              ["Connexions anciennes (appareils fermés ou expirés)", "Supprimées après 30 jours"],
              ["Journal d’activité", "Conservé 1 an ; vous voyez les 90 derniers jours"],
              ["Demandes de récupération de compte", "Supprimées après 30 jours"],
              [
                "Compte supprimé",
                "Désactivé immédiatement, puis effacé après 30 jours (vous pouvez annuler pendant ce délai)",
              ],
              [
                "Commandes et paiements passés",
                "Conservés sans votre nom, pour la comptabilité et les litiges éventuels",
              ],
              [
                "Avis laissés",
                "Conservés et visibles sans votre nom après la suppression du compte",
              ],
              [
                "Documents d’identité et professionnels",
                "Effacés après la suppression du compte, sauf si la loi oblige à les garder plus longtemps",
              ],
            ],
          },
        },
      ],
    },
    {
      id: "suppression",
      title: "Quand vous supprimez votre compte",
      blocks: [
        "Après 30 jours, nous effaçons le profil, les contacts (principaux et de récupération), les appareils, les adresses, les favoris et les documents d’identité envoyés pour la vérification. L’adresse e-mail et le numéro de téléphone sont libérés : vous pouvez vous réinscrire avec les mêmes, mais vous retrouvez un compte vide.",
        "Avant la suppression, vous pouvez télécharger une copie de votre profil, de vos adresses, de votre historique de commandes, de vos favoris et de vos avis. Vous la recevez sur votre contact principal, après une nouvelle vérification.",
      ],
    },
    {
      id: "vos-droits",
      title: "Vos droits",
      blocks: [
        "Vous gardez le contrôle de vos données :",
        {
          list: [
            "**Accéder** à vos informations et en obtenir une copie, depuis votre profil.",
            "**Corriger** votre nom, vos contacts, vos adresses et votre photo.",
            "**Supprimer** votre compte et vos données, dans les limites décrites ci-dessus.",
            "**Choisir** ce que vous recevez : notifications, SMS, e-mails, offres et promotions.",
            "**Contrôler** l’accès à votre position depuis les réglages de votre téléphone.",
            "**Surveiller** l’activité de votre compte et déconnecter un appareil ou tous.",
          ],
        },
        `Si vous ne parvenez pas à exercer un droit depuis l’application, écrivez à ${email}. Nous répondons dans un délai raisonnable.`,
      ],
    },
    {
      id: "securite",
      title: "Comment nous protégeons vos données",
      blocks: [
        {
          list: [
            "Les mots de passe ne sont jamais conservés tels quels.",
            "Les codes reçus par e-mail ou par SMS ne servent qu’une fois, expirent après quelques minutes, et le nombre d’essais et d’envois est limité.",
            "Vous êtes prévenu quand quelqu’un se connecte depuis un nouvel appareil, ou quand votre mot de passe ou vos contacts changent.",
            "Les actions sensibles demandent un nouveau code.",
            "Les documents d’identité sont gardés en privé, avec un accès limité et journalisé.",
            "Les membres de l’équipe SwiftGoma doivent activer la double vérification.",
          ],
        },
        "Aucun système n’est infaillible. Si une violation de données vous concernait, nous vous en informerions.",
      ],
    },
    {
      id: "mineurs",
      title: "Mineurs",
      blocks: [
        "SwiftGoma est réservé aux personnes d’au moins 18 ans. Nous ne collectons pas sciemment de données sur des mineurs. Si vous pensez qu’un mineur a créé un compte, écrivez-nous et nous le supprimerons.",
      ],
    },
    {
      id: "cookies",
      title: "Cookies",
      blocks: [
        "Le site web utilise uniquement les cookies nécessaires au fonctionnement de votre connexion. Les détails figurent dans notre [politique relative aux cookies](/legale/cookies).",
      ],
    },
    {
      id: "modifications",
      title: "Modifications de cette politique",
      blocks: [
        "Nous pouvons mettre à jour cette politique. La date de dernière mise à jour figure en haut de la page, et nous vous informons des changements importants dans l’application. La date et la version que vous avez acceptées à l’inscription sont conservées.",
      ],
    },
  ],
};
