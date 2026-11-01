export const riderSteps = [
  {
    title: "Recevez la demande",
    description:
      "Vous voyez l’adresse de la boutique, celle de l’acheteur, les produits et le montant convenu. Vous confirmez avant de partir.",
  },
  {
    title: "Récupérez la commande",
    description:
      "Vous passez à la boutique et prenez le colis. Vous en êtes responsable jusqu’à l’acheteur.",
  },
  {
    title: "Partez vers l’acheteur",
    description: "Votre position est partagée en direct, pendant la livraison seulement.",
  },
  {
    title: "Arrivez",
    description:
      "Appelez l’acheteur si besoin. S’il est absent, attendez 10 minutes puis signalez-le : vous êtes payé quand même.",
  },
  {
    title: "Scannez le code QR",
    description:
      "Le scan confirme la remise. S’il ne marche pas, l’acheteur vous dicte le code à 6 chiffres.",
  },
] as const;

export const riderAlerts = [
  {
    title: "Nouvelle course",
    detail: "La boutique, l’acheteur et le montant convenu, à confirmer avant de partir.",
    critical: true,
  },
  {
    title: "Course annulée",
    detail: "Vous êtes prévenu tout de suite, pour ne pas vous déplacer pour rien.",
    critical: false,
  },
  {
    title: "Commande prête",
    detail: "La boutique a fini de préparer le colis.",
    critical: false,
  },
  {
    title: "Problème signalé",
    detail: "Sur une commande en cours.",
    critical: false,
  },
  {
    title: "Paiement envoyé",
    detail: "Votre retrait est parti vers votre Mobile Money.",
    critical: false,
  },
] as const;

export const riderDocuments = [
  {
    title: "Pièce d’identité et selfie",
    detail: "Le Support vérifie que le selfie correspond à la pièce d’identité.",
  },
  {
    title: "Permis de conduire",
    detail: "Moto ou voiture. Il a une date de fin : un rappel vous arrive 30 jours avant.",
  },
  {
    title: "Photo du véhicule et de sa plaque",
    detail: "Lisible, pour que les acheteurs sachent qui leur livre.",
  },
] as const;

export const riderOnboarding = [
  "Vous créez votre compte livreur depuis l’application.",
  "Vous acceptez le contrat : vous cochez « J’accepte » et vous confirmez avec un code reçu sur votre téléphone. Une copie PDF est disponible.",
  "Vous envoyez vos documents.",
  "Le Support vérifie, puis un Admin décide : approuver, ou refuser avec une explication.",
  "Dossier approuvé : le contrat devient actif et vous pouvez demander une liaison avec une boutique.",
] as const;

export const riderFreedoms = [
  "Vous n’êtes pas employé de SwiftGoma ni d’une boutique.",
  "Vous pouvez travailler avec plusieurs boutiques à la fois.",
  "Le vendeur accepte ou refuse votre demande : la liaison n’est active qu’après.",
  "Vous quittez une boutique, ou elle vous retire, à tout moment.",
] as const;

export const riderEngagements = [
  {
    title: "Scanner le QR",
    detail: "Le scan est obligatoire pour confirmer la remise.",
  },
  {
    title: "Prendre soin du colis",
    detail: "Vous êtes responsable de la commande, de la boutique jusqu’à l’acheteur.",
  },
  {
    title: "Respecter les clients",
    detail: "Vous êtes poli et respectueux avec les acheteurs et les vendeurs.",
  },
  {
    title: "Livrer vous-même",
    detail: "Vous ne confiez pas la commande à quelqu’un d’autre.",
  },
] as const;

export const riderSuspensions = [
  "Des documents faux ou expirés.",
  "Une commande qui n’est pas remise.",
  "Un comportement abusif.",
  "Une fraude.",
] as const;

export const riderQuestions = [
  {
    question: "Suis-je employé de SwiftGoma ?",
    answer:
      "Non. Vous êtes livreur indépendant : ni employé de SwiftGoma, ni employé d’une boutique. Vous organisez votre travail librement, dans le respect des règles de livraison.",
  },
  {
    question: "Comment le contrat est-il accepté ?",
    answer:
      "Dans l’application, sans papier : vous lisez le contrat, vous cochez « J’accepte » et vous saisissez un code reçu sur votre téléphone. SwiftGoma garde la date, l’heure et la version acceptées, et vous pouvez télécharger une copie en PDF. Il devient actif quand votre dossier est approuvé.",
  },
  {
    question: "Quels documents dois-je envoyer ?",
    answer:
      "Une pièce d’identité et un selfie, votre permis de conduire (moto ou voiture), et une photo de votre véhicule avec sa plaque. Vos documents restent privés et ne sont vus que par les personnes autorisées de l’équipe.",
  },
  {
    question: "Que se passe-t-il si mon dossier est refusé ?",
    answer:
      "Vous recevez une explication, vous corrigez et vous renvoyez. Vous avez 3 essais, puis vous devez contacter le Support.",
  },
  {
    question: "Comment suis-je payé ?",
    answer:
      "Pour chaque livraison réussie, vous recevez 100 % du montant convenu avec la boutique. Il arrive dans votre portefeuille, dans la monnaie de la commande : SwiftGoma ne convertit pas entre dollars et francs congolais. Après le scan du QR, il reste en attente 24 heures, puis il est disponible.",
  },
  {
    question: "Comment retirer mes gains ?",
    answer:
      "Sur votre numéro Mobile Money, avec un nouveau code pour confirmer chaque retrait. Il existe un minimum, un maximum et un plafond par jour dans chaque monnaie, et le fournisseur de paiement prélève des frais, affichés avant la confirmation.",
  },
  {
    question: "Mon retrait peut-il être bloqué ?",
    answer:
      "Un retrait peut être mis en pause si une alerte de fraude se déclenche. Après une récupération de compte, les retraits sont aussi bloqués pendant 72 heures.",
  },
  {
    question: "Et si l’acheteur est absent ?",
    answer:
      "Vous attendez 10 minutes et vous l’appelez, puis vous signalez « acheteur absent ». La commande revient au vendeur et vous êtes payé du montant convenu. Le Support décide ensuite si l’acheteur est remboursé.",
  },
  {
    question: "Que se passe-t-il s’il y a un litige sur une commande ?",
    answer: "L’argent concerné reste en attente jusqu’à la décision du Support ou d’un Admin.",
  },
  {
    question: "Ma position est-elle suivie en permanence ?",
    answer:
      "Non. Elle est partagée seulement pendant les livraisons en cours, pour que l’acheteur voie sa commande avancer et que la boutique suive la course.",
  },
  {
    question: "Que se passe-t-il quand mon permis expire ?",
    answer:
      "Vous recevez un rappel 30 jours avant. Si le nouveau document n’est pas envoyé à temps, votre compte est mis en pause jusqu’à l’envoi.",
  },
  {
    question: "Mon compte peut-il être suspendu, et puis-je le supprimer ?",
    answer:
      "SwiftGoma peut suspendre un compte qui ne respecte pas les règles : documents faux ou expirés, commande non remise, comportement abusif ou fraude. Vous pouvez écrire au Support depuis l’écran de connexion, et un Admin décide. Vous pouvez aussi mettre fin au contrat en supprimant votre compte, sauf tant qu’une livraison est en cours ou qu’un litige est ouvert.",
  },
] as const;
