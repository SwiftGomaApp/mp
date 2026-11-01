import { legalConfig } from "@/lib/legal/config";
import type { LegalDocument } from "@/lib/legal/types";

const email = `[${legalConfig.supportEmail}](mailto:${legalConfig.supportEmail})`;

export const terms: LegalDocument = {
  slug: "terms",
  title: "Conditions générales d’utilisation",
  shortTitle: "Conditions d’utilisation",
  description:
    "Les règles d’utilisation de la place de marché SwiftGoma à Goma : comptes, commandes, paiement sécurisé par code QR, livraison, litiges et suspension.",
  lastUpdated: legalConfig.lastUpdated,
  version: legalConfig.version,
  intro:
    "SwiftGoma MarketPlace est la place de marché de Goma, accessible depuis un téléphone. Ces conditions expliquent comment l’utiliser. En créant un compte, vous les acceptez, ainsi que notre [politique de confidentialité](/legale/privacy).",
  sections: [
    {
      id: "objet",
      title: "Objet et acceptation",
      blocks: [
        "SwiftGoma met en relation des acheteurs, des vendeurs et des livreurs indépendants à Goma, en République démocratique du Congo. Les habitants découvrent les boutiques de leur ville, choisissent des produits, paient en ligne, puis se font livrer ou viennent récupérer leur commande.",
        "Pour utiliser SwiftGoma, vous devez accepter les présentes conditions et la politique de confidentialité au moment de votre inscription. La date et la version que vous avez acceptées sont conservées.",
        "Selon votre rôle, des conditions particulières s’ajoutent à celles-ci :",
        {
          list: [
            "[Conditions acheteur](/legale/buyer-terms)",
            "[Conditions vendeur](/legale/seller-terms)",
            "[Conditions livreur](/legale/rider-terms)",
          ],
        },
        "En cas de contradiction, les conditions particulières de votre rôle prévalent sur les présentes conditions pour ce qui concerne ce rôle.",
      ],
    },
    {
      id: "compte",
      title: "Votre compte",
      blocks: [
        {
          heading: "Âge minimum",
        },
        "Vous devez avoir au moins 18 ans pour créer un compte. Vous le confirmez en cochant une case lors de l’inscription.",
        { heading: "Création du compte" },
        "Vous pouvez vous inscrire avec votre adresse e-mail, avec votre numéro de téléphone ou avec votre compte Google. Pour une inscription par e-mail ou par téléphone, vous recevez un code que vous saisissez pour confirmer que l’adresse ou le numéro vous appartient. Seuls les numéros de la RDC (+243) sont acceptés.",
        "Une inscription qui n’est pas confirmée dans les 3 jours est supprimée.",
        { heading: "Un compte, un rôle" },
        "Chaque compte a un seul rôle : acheteur, vendeur ou livreur. Un vendeur peut aussi commander chez d’autres vendeurs, comme n’importe quel acheteur, mais il ne peut pas commander dans sa propre boutique.",
        { heading: "Exactitude des informations" },
        "Les informations que vous donnez doivent être exactes et à jour. Vous ne pouvez pas créer un compte au nom d’une autre personne ni utiliser le compte d’un autre.",
        { heading: "Sécurité de votre compte" },
        {
          list: [
            "Gardez vos moyens de connexion et vos codes pour vous. Les codes reçus par e-mail ou par SMS ne servent qu’une fois et expirent après quelques minutes.",
            "Vous pouvez utiliser un même compte sur plusieurs appareils, jusqu’à 5. À la sixième connexion, l’appareil le plus ancien est déconnecté.",
            "Vous pouvez activer la double vérification pour mieux protéger votre compte.",
            "Pour certaines actions sensibles (changer votre numéro, votre e-mail, votre mot de passe ou votre numéro de versement), un nouveau code vous est demandé même si vous êtes connecté.",
            "Si vous pensez que quelqu’un d’autre utilise votre compte, déconnectez vos appareils depuis l’écran de sécurité et prévenez le Support.",
          ],
        },
        "Vous êtes responsable de l’activité réalisée depuis votre compte tant que vous n’avez pas signalé un accès non autorisé.",
      ],
    },
    {
      id: "commandes-et-paiement",
      title: "Commandes et paiement",
      blocks: [
        "Vous pouvez parcourir les boutiques sans compte. Un compte est demandé au moment de commander ou d’ajouter un favori.",
        { heading: "Prix et monnaies" },
        "Chaque boutique fixe tous ses prix dans une seule monnaie, dollars ou francs congolais, et vous payez dans cette monnaie. Le prix affiché est le prix que vous payez : la livraison est incluse. L’équivalent dans l’autre monnaie est affiché à titre indicatif, d’après un taux de référence mis à jour chaque semaine ; il n’est jamais utilisé pour convertir un paiement.",
        { heading: "Paiement sécurisé" },
        "Vous payez en ligne avec Mobile Money. Vous confirmez le paiement sur votre téléphone avec votre code secret, dans un délai de 5 minutes, sans quoi il est annulé. Votre argent est retenu en sécurité : il n’est versé au vendeur que lorsque vous confirmez avoir reçu votre commande en montrant votre code QR.",
        { heading: "Le code QR" },
        "Chaque commande a un code QR à usage unique, visible dans le détail de la commande. Montrez-le uniquement à la réception de votre commande. Le scan par le livreur ou par le vendeur confirme la remise et déclenche le paiement du vendeur. Ne le communiquez à personne avant d’avoir reçu votre commande.",
        { heading: "Réponse du vendeur et annulation" },
        {
          list: [
            "Le vendeur a 15 minutes pour accepter ou refuser votre commande. S’il refuse ou ne répond pas, vous êtes remboursé automatiquement.",
            "Vous pouvez annuler votre commande tant que le vendeur ne l’a pas acceptée ; vous êtes alors remboursé automatiquement.",
            "Une fois la commande acceptée, vous ne pouvez plus l’annuler seul : signalez un problème et le Support examine votre demande.",
          ],
        },
        "Le détail des règles applicables aux acheteurs figure dans les [conditions acheteur](/legale/buyer-terms).",
      ],
    },
    {
      id: "livraison-et-retrait",
      title: "Livraison et retrait",
      blocks: [
        "À chaque commande, vous choisissez d’être livré ou de venir chercher votre commande. La livraison n’est proposée que si la boutique livre et que votre adresse se trouve dans sa zone. Une boutique qui ne livre pas chez vous reste visible, avec la mention « Ne livre pas chez vous ». Le retrait en boutique reste possible.",
        "Les livraisons sont assurées par des livreurs indépendants, vérifiés par SwiftGoma. Ils ne sont ni employés de SwiftGoma ni employés d’une boutique. Les commandes sont toujours pour « le plus vite possible » : vous ne pouvez pas choisir un jour ou une heure.",
      ],
    },
    {
      id: "problemes-et-litiges",
      title: "Problèmes, remboursements et litiges",
      blocks: [
        "Pendant 7 jours après la remise, vous pouvez signaler un problème sur une commande depuis l’application (« Signaler un problème »). Votre demande est examinée par l’équipe SwiftGoma :",
        {
          steps: [
            "Un ticket est créé et rattaché à l’historique complet de la commande (suivi, scans, paiement, horaires).",
            "Le Support examine le dossier et règle directement ce qui relève de son autorité, par exemple un remboursement dans la limite qui lui est fixée.",
            "Ce qui dépasse cette limite, une fraude suspectée ou un cas répété est transmis à un Admin, qui prend la décision finale : remboursement, remboursement partiel, aucun remboursement ou mesure sur un compte.",
            "Toutes les personnes concernées par la commande sont informées du résultat.",
          ],
        },
        "Lorsqu’un litige est ouvert, l’argent concerné reste en attente jusqu’à la décision. Un remboursement est versé sur le moyen de paiement que vous avez utilisé.",
      ],
    },
    {
      id: "avis",
      title: "Avis et contenus",
      blocks: [
        "Pendant 7 jours après la remise, vous pouvez noter le vendeur, les produits et le livreur, et laisser un commentaire. Votre avis doit être honnête, respectueux et fondé sur votre expérience. Vous choisissez dans vos préférences le nom affiché dans vos avis : nom complet, prénom avec l’initiale du nom, ou anonyme.",
        "Les avis qui contiennent des insultes, des menaces, des informations personnelles ou de la publicité peuvent être retirés.",
      ],
    },
    {
      id: "comportements-interdits",
      title: "Comportements interdits",
      blocks: [
        "Il est interdit, sur SwiftGoma :",
        {
          list: [
            "d’utiliser la plateforme pour vendre ou acheter des produits interdits par la loi ;",
            "de tromper les autres utilisateurs : faux produits, fausses descriptions, faux avis, fausse identité ;",
            "de contourner le paiement de la plateforme ou de demander un paiement en dehors de l’application pour une commande passée sur SwiftGoma ;",
            "de harceler, menacer ou insulter un acheteur, un vendeur, un livreur ou l’équipe SwiftGoma ;",
            "de tenter d’accéder au compte d’autrui, de perturber le service ou d’exploiter une faille ;",
            "d’abuser des codes envoyés par SMS ou par e-mail, ou des codes promo.",
          ],
        },
      ],
    },
    {
      id: "suspension",
      title: "Suspension et fermeture d’un compte",
      blocks: [
        "Si un compte ne respecte pas les règles, l’équipe SwiftGoma peut le suspendre ou le bannir. La personne est alors déconnectée de tous ses appareils immédiatement et ne peut plus se reconnecter.",
        "Elle peut écrire au Support depuis l’écran de connexion : l’équipe examine sa demande et un Admin décide.",
      ],
    },
    {
      id: "suppression",
      title: "Supprimer votre compte",
      blocks: [
        "Vous pouvez supprimer votre compte depuis votre profil, en bas de l’écran « Mon profil ». La suppression se fait en plusieurs étapes, avec un nouveau code de confirmation.",
        {
          list: [
            "La suppression est refusée s’il reste une commande en cours, un litige ouvert ou un paiement en attente ; l’application vous explique ce qu’il reste à terminer.",
            "Avant de supprimer, vous pouvez télécharger une copie de vos données.",
            "Le compte est désactivé tout de suite. Pendant 30 jours, vous pouvez annuler en vous reconnectant. Après 30 jours, la suppression est définitive.",
            "Les commandes et paiements passés sont gardés sans votre nom, pour la comptabilité et les litiges éventuels.",
          ],
        },
        "Pour savoir ce qui est effacé et ce qui est conservé, consultez la [politique de confidentialité](/legale/privacy).",
      ],
    },
    {
      id: "responsabilite",
      title: "Rôle de SwiftGoma et responsabilité",
      blocks: [
        "SwiftGoma fournit la plateforme qui permet aux acheteurs, aux vendeurs et aux livreurs de se rencontrer et de conclure leurs commandes en confiance. Chaque vendeur est responsable des produits qu’il propose, de leur description et de leur prix ; chaque livreur est responsable de la commande qu’il transporte pendant le trajet.",
        "SwiftGoma vérifie l’identité des vendeurs et des livreurs, retient l’argent des commandes jusqu’à la remise et aide à résoudre les problèmes. Nous faisons le maximum pour que le service soit disponible en continu, mais nous ne pouvons pas garantir qu’il sera exempt d’interruptions, notamment en cas de problème de réseau ou de force majeure.",
        "Rien dans ces conditions ne limite les droits qui vous sont reconnus par la loi applicable en RDC.",
      ],
    },
    {
      id: "modifications",
      title: "Modifications des conditions",
      blocks: [
        "Nous pouvons mettre ces conditions à jour, par exemple lorsque le service évolue. La date de dernière mise à jour figure en haut de cette page. Nous vous informons des changements importants dans l’application, et la nouvelle version vous est présentée pour acceptation lorsque cela est nécessaire.",
        "Si vous n’acceptez pas une nouvelle version, vous pouvez cesser d’utiliser SwiftGoma et supprimer votre compte.",
      ],
    },
    {
      id: "droit-applicable",
      title: "Droit applicable",
      blocks: [
        "Ces conditions sont régies par le droit de la République démocratique du Congo. En cas de désaccord que le Support n’a pas pu résoudre, les tribunaux compétents de la RDC sont saisis.",
      ],
    },
    {
      id: "contact",
      title: "Nous contacter",
      blocks: [`Une question sur ces conditions ? Écrivez-nous à ${email}.`],
    },
  ],
};
