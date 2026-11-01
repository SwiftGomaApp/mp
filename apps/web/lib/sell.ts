export const sellerBenefits = [
  {
    title: "Une vitrine pour tout Goma",
    description:
      "Vos produits sont visibles par les habitants de la ville, classés par catégorie et par distance. Votre boutique est ouverte tous les jours, même quand la porte est fermée.",
  },
  {
    title: "Un paiement sans risque",
    description:
      "L’argent de l’acheteur est retenu en sécurité dès la commande, puis versé quand il confirme la réception avec son code QR. Plus de mauvaise surprise.",
  },
  {
    title: "Des livreurs vérifiés",
    description:
      "Vous travaillez avec des livreurs indépendants dont l’identité a été vérifiée par SwiftGoma. Vous choisissez qui livre et vous convenez du montant avec lui.",
  },
  {
    title: "Tout au même endroit",
    description:
      "Produits, commandes, portefeuille et retraits sur Mobile Money : vous gérez votre boutique depuis votre téléphone.",
  },
] as const;

export const sellerSteps = [
  {
    title: "Créez votre compte vendeur",
    description:
      "Avec votre e-mail, votre téléphone ou votre compte Google. Choisissez le rôle « Vendre ».",
  },
  {
    title: "Envoyez vos documents",
    description:
      "Pièce d’identité, registre de commerce, numéro d’impôt et photos de la boutique. Le Support les examine.",
  },
  {
    title: "Acceptez le contrat",
    description:
      "Dans l’application, sans papier : vous le lisez, cochez « J’accepte » et confirmez avec un code.",
  },
  {
    title: "Faites valider votre boutique",
    description:
      "Quand votre dossier est approuvé et que vos informations de paiement sont complètes, votre boutique devient visible.",
  },
  {
    title: "Publiez vos produits",
    description: "Photos, description, prix et variantes : taille, couleur ou autre choix.",
  },
  {
    title: "Recevez vos commandes et soyez payé",
    description:
      "Vous avez 15 minutes pour accepter chaque commande. Après la remise, l’argent arrive dans votre portefeuille.",
  },
] as const;

export const sellerDocuments = [
  "Pièce d’identité du propriétaire et un selfie",
  "Registre de commerce ou autorisation d’exploitation",
  "Numéro d’impôt",
  "Photos de la boutique",
  "Numéro Mobile Money de versement, au même nom que la pièce d’identité",
] as const;

export const sellerRequirements = [
  "Dossier approuvé",
  "Contrat accepté",
  "Au moins un contact de récupération (e-mail ou téléphone de secours)",
  "Numéro Mobile Money de versement ajouté et vérifié",
] as const;

export const payoutSteps = [
  { title: "L’acheteur paie", description: "L’argent est retenu en sécurité." },
  { title: "Vous préparez et remettez", description: "En livraison ou en retrait en boutique." },
  { title: "Le code QR est scanné", description: "La remise est confirmée, l’argent est réparti." },
  { title: "24 heures d’attente", description: "Le temps de signaler un éventuel problème." },
  { title: "Vous retirez", description: "Sur votre numéro Mobile Money, quand vous voulez." },
] as const;

export const sellerQuestions = [
  {
    question: "Faut-il payer pour ouvrir une boutique ?",
    answer:
      "Créer un compte vendeur est gratuit. SwiftGoma prélève une commission sur chaque commande ; elle est décrite dans l’annexe « Commission » du contrat vendeur, que vous lisez avant d’accepter.",
  },
  {
    question: "Combien de temps pour être validé ?",
    answer:
      "Le Support examine votre dossier, puis un Admin prend la décision. Vous êtes prévenu à chaque étape. Si le dossier est refusé, vous voyez pourquoi, vous corrigez et vous renvoyez.",
  },
  {
    question: "Qui fixe mes prix ?",
    answer:
      "Vous. Chaque boutique fixe tous ses prix dans une seule monnaie, dollars ou francs congolais. Le prix affiché à l’acheteur est le prix payé, livraison comprise.",
  },
  {
    question: "Dois-je proposer la livraison ?",
    answer:
      "C’est votre choix. Vous décidez si vous livrez, dans quelles zones, et vous convenez du montant avec le livreur de votre boutique. Le retrait en boutique reste possible.",
  },
  {
    question: "Quand l’argent arrive-t-il dans mon portefeuille ?",
    answer:
      "Après le scan du code QR, l’argent reste « en attente » 24 heures, puis devient disponible. En cas de litige, il reste en attente jusqu’à la décision du Support.",
  },
  {
    question: "Que se passe-t-il si je ne réponds pas à une commande ?",
    answer:
      "Vous avez 15 minutes pour accepter ou refuser, avec un rappel à 5 minutes. Sans réponse, l’acheteur est remboursé automatiquement.",
  },
] as const;

export interface SellerTestimonial {
  id: string;
  quote: string;
  name: string;
  detail: string;
}

// TODO: placeholder content. Replace with the testimonials returned by the backend once the
export const sellerFeaturedTestimonial: SellerTestimonial = {
  id: "featured",
  quote:
    "Avant, je ne vendais qu’aux clients qui passaient devant la boutique. Maintenant, les commandes arrivent même quand je suis fermée.",
  name: "Aminata K.",
  detail: "Maroquinerie Aminata, Himbi",
};

export const sellerTestimonials: SellerTestimonial[] = [
  {
    id: "t1",
    quote: "Le code QR change tout : le client confirme, et je sais que l’argent est à moi.",
    name: "Jean-Paul M.",
    detail: "@elec_goma",
  },
  {
    id: "t2",
    quote:
      "J’ai ouvert ma boutique depuis mon téléphone en une soirée. Le Support m’a aidé pour un document et tout était validé le lendemain.",
    name: "Grâce B.",
    detail: "@mode_grace",
  },
  {
    id: "t3",
    quote:
      "Je choisis mon livreur moi-même et je connais le prix avant qu’il parte. Pas de mauvaise surprise.",
    name: "Patrick S.",
    detail: "@chaussures_patrick",
  },
  {
    id: "t4",
    quote:
      "Je retire mes gains sur M-Pesa quand j’en ai besoin. C’est simple, et je vois tout dans mon portefeuille.",
    name: "Christelle N.",
    detail: "@christelle_cosmetics",
  },
  {
    id: "t5",
    quote:
      "Chaque nouvelle commande sonne sur mon téléphone, même derrière le comptoir. Je n’en rate plus.",
    name: "Désiré T.",
    detail: "@quincaillerie_desire",
  },
  {
    id: "t6",
    quote: "Mes clients me trouvent par quartier. Ceux de Ndosho commandent de plus en plus.",
    name: "Esther L.",
    detail: "@esther_boutique",
  },
  {
    id: "t7",
    quote:
      "Le contrat se signe dans l’application, sans papier. J’ai accepté, confirmé avec un code, et c’était fait.",
    name: "Joël K.",
    detail: "@joel_phones",
  },
  {
    id: "t8",
    quote: "Je suis payé en dollars, et je vois ce qui est en attente et ce qui est disponible.",
    name: "Béatrice M.",
    detail: "@beatrice_wax",
  },
];
