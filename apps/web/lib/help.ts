import {
  CreditCard,
  Package,
  QrCode,
  Store,
  Truck,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export type HelpCategoryId = "account" | "orders" | "payment" | "delivery" | "seller" | "rider";

export interface HelpCategory {
  id: HelpCategoryId;
  label: string;
  description: string;
  icon: LucideIcon;
}

export interface HelpQuestion {
  category: HelpCategoryId;
  question: string;
  answer: string;
}

export const helpCategories: HelpCategory[] = [
  {
    id: "account",
    label: "Compte et sécurité",
    description: "Connexion, mot de passe, double authentification, récupération.",
    icon: UserRound,
  },
  {
    id: "orders",
    label: "Commandes",
    description: "Passer, suivre, modifier ou annuler une commande.",
    icon: Package,
  },
  {
    id: "payment",
    label: "Paiement",
    description: "Mobile Money, carte bancaire, code QR et remboursements.",
    icon: CreditCard,
  },
  {
    id: "delivery",
    label: "Livraison et retrait",
    description: "Délais, frais, retrait en boutique, commande en retard.",
    icon: Truck,
  },
  {
    id: "seller",
    label: "Vendre sur SwiftGoma",
    description: "Ouvrir une boutique, publier des produits, être payé.",
    icon: Store,
  },
  {
    id: "rider",
    label: "Devenir livreur",
    description: "S’inscrire, accepter des courses, suivre ses gains.",
    icon: QrCode,
  },
];

export const helpQuestions: HelpQuestion[] = [
  {
    category: "account",
    question: "Comment créer un compte ?",
    answer:
      "Choisissez « S’inscrire », puis votre rôle (acheteur, vendeur ou livreur) et saisissez votre adresse e-mail ou votre numéro de téléphone. Un code à 6 chiffres vous est envoyé pour confirmer que le contact est bien le vôtre. Vous pouvez aussi continuer avec Google ou une clé d’accès.",
  },
  {
    category: "account",
    question: "Je ne reçois pas le code de vérification",
    answer:
      "Vérifiez d’abord le dossier des courriers indésirables et la qualité de votre réseau. Attendez la fin du décompte avant de demander un nouveau code, puis utilisez le plus récent : les anciens codes deviennent invalides. Si rien n’arrive, essayez avec l’autre moyen de contact de votre compte.",
  },
  {
    category: "account",
    question: "J’ai oublié mon mot de passe",
    answer:
      "Sur l’écran « Se connecter avec un mot de passe », choisissez « Mot de passe oublié ». Vous recevrez un code de vérification pour en définir un nouveau. Vous pouvez aussi vous connecter sans mot de passe, avec un code envoyé par e-mail ou SMS.",
  },
  {
    category: "account",
    question: "Je n’ai plus accès à mon e-mail ni à mon téléphone",
    answer:
      "Utilisez « Récupérer mon compte » sur l’écran de connexion. Par sécurité, la récupération passe par un délai d’attente pendant lequel le propriétaire du compte est prévenu et peut l’annuler. Si vous avez ajouté des contacts de récupération, ils peuvent aussi vous aider.",
  },
  {
    category: "account",
    question: "Mon compte est suspendu, que faire ?",
    answer:
      "Un compte suspendu ne peut plus se connecter. Écrivez au Support depuis le formulaire de cette page ou depuis « Contacter le Support » sur l’écran de connexion, en indiquant l’adresse ou le numéro du compte et votre situation.",
  },
  {
    category: "account",
    question: "Comment activer la double authentification ?",
    answer:
      "Ouvrez Profil, puis l’onglet Sécurité, et choisissez l’application d’authentification. Scannez le code QR avec votre application, saisissez le code affiché, puis conservez précieusement vos codes de secours : ils sont votre dernier recours si vous perdez votre téléphone.",
  },
  {
    category: "orders",
    question: "Comment passer une commande ?",
    answer:
      "Ajoutez les produits de la boutique à votre panier, choisissez la livraison à domicile ou le retrait en boutique, puis payez. Vous recevez une confirmation et pouvez suivre l’avancement de la commande depuis votre compte.",
  },
  {
    category: "orders",
    question: "Puis-je modifier ou annuler ma commande ?",
    answer:
      "Tant que le vendeur n’a pas commencé à la préparer, vous pouvez l’annuler depuis le détail de la commande. Une fois la préparation lancée, contactez le vendeur ou le Support. Une commande annulée avant expédition est remboursée.",
  },
  {
    category: "orders",
    question: "Mon produit est abîmé, incomplet ou ne correspond pas à l’annonce",
    answer:
      "Signalez-le dès la réception, avec des photos du produit et de l’emballage. Le Support examine la situation avec le vendeur et vous propose un remplacement ou un remboursement.",
  },
  {
    category: "payment",
    question: "Quels moyens de paiement sont acceptés ?",
    answer:
      "Mobile Money (M-Pesa, Airtel Money, Orange Money) et carte bancaire. Vous pouvez aussi payer avec un code QR, depuis votre application de paiement.",
  },
  {
    category: "payment",
    question: "Mon argent a été débité mais la commande n’apparaît pas",
    answer:
      "Patientez quelques minutes : la confirmation peut être retardée par le réseau. Si la commande n’apparaît toujours pas, contactez le Support avec la référence de la transaction ; si le paiement n’a pas abouti, le montant vous est rendu.",
  },
  {
    category: "payment",
    question: "Comment fonctionne le paiement par code QR ?",
    answer:
      "Au moment de payer, un code QR est affiché. Scannez-le avec votre application de paiement et validez le montant : la commande est confirmée dès que le paiement est reçu.",
  },
  {
    category: "payment",
    question: "Comment suis-je remboursé ?",
    answer:
      "Le remboursement est effectué par le moyen de paiement utilisé lors de la commande. Le délai dépend de votre opérateur ou de votre banque.",
  },
  {
    category: "delivery",
    question: "Quels sont les délais et les frais de livraison ?",
    answer:
      "Ils dépendent de la boutique et de la distance jusqu’à votre adresse. Les frais sont affichés avant le paiement, jamais après.",
  },
  {
    category: "delivery",
    question: "Comment retirer ma commande en boutique ?",
    answer:
      "Choisissez « Retrait en boutique » au moment de commander. Quand la commande est prête, présentez-vous avec votre code de retrait.",
  },
  {
    category: "delivery",
    question: "Ma commande est en retard",
    answer:
      "Suivez son avancement depuis votre compte. Si le retard dépasse l’estimation indiquée, contactez le vendeur, puis le Support si vous n’avez pas de réponse.",
  },
  {
    category: "seller",
    question: "Comment ouvrir ma boutique ?",
    answer:
      "Créez un compte vendeur, renseignez les informations de votre boutique et de votre activité, puis publiez vos premiers produits. Votre boutique est visible une fois vérifiée.",
  },
  {
    category: "seller",
    question: "Comment suis-je payé ?",
    answer:
      "Les paiements des commandes livrées sont versés sur votre compte Mobile Money ou bancaire enregistré. Le détail de chaque commande est disponible dans votre espace vendeur.",
  },
  {
    category: "seller",
    question: "Quelles sont les règles applicables aux vendeurs ?",
    answer:
      "Elles sont décrites dans les conditions vendeur : produits autorisés, commissions, retours et litiges. Vous les trouverez dans les informations légales en bas de cette page.",
  },
  {
    category: "rider",
    question: "Comment devenir livreur ?",
    answer:
      "Créez un compte livreur et complétez votre profil. Une fois validé, vous pouvez accepter des courses dans votre zone.",
  },
  {
    category: "rider",
    question: "Comment sont calculés mes gains ?",
    answer:
      "Chaque course est rémunérée selon la distance et le type de livraison, le montant étant affiché avant que vous acceptiez. Vos gains sont suivis depuis votre espace livreur.",
  },
];

export interface HelpGuide {
  title: string;
  description: string;
  steps: string[];
  icon: LucideIcon;
}

export const helpGuides: HelpGuide[] = [
  {
    title: "Acheter",
    description: "De la boutique à votre porte.",
    icon: Package,
    steps: [
      "Parcourez les boutiques de Goma.",
      "Ajoutez vos produits au panier.",
      "Payez par Mobile Money, carte ou code QR.",
      "Recevez-les chez vous ou retirez-les en boutique.",
    ],
  },
  {
    title: "Vendre",
    description: "Lancez votre boutique en ligne.",
    icon: Store,
    steps: [
      "Créez votre compte vendeur.",
      "Présentez votre boutique.",
      "Publiez vos produits avec photos et prix.",
      "Préparez les commandes et recevez vos paiements.",
    ],
  },
  {
    title: "Livrer",
    description: "Gagnez de l’argent en livrant autour de vous.",
    icon: Truck,
    steps: [
      "Créez votre compte livreur.",
      "Faites valider votre profil.",
      "Acceptez les courses proches de vous.",
      "Livrez et suivez vos gains.",
    ],
  },
];

export const safetyTips = [
  "Ne communiquez jamais un code de vérification, même à quelqu’un qui se présente comme le Support.",
  "Payez toujours depuis SwiftGoma : n’envoyez pas d’argent en dehors de la plateforme.",
  "Activez la double authentification dans Profil, onglet Sécurité.",
];
