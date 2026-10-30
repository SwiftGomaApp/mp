import { legalConfig } from "@/lib/legal/config";
import type { LegalDocument } from "@/lib/legal/types";

const email = `[${legalConfig.supportEmail}](mailto:${legalConfig.supportEmail})`;

export const buyerTerms: LegalDocument = {
  slug: "buyer-terms",
  title: "Conditions acheteur",
  shortTitle: "Acheteurs",
  description:
    "Les règles qui s’appliquent aux acheteurs SwiftGoma : panier, paiement retenu en sécurité, code QR de remise, annulation, remboursement et avis.",
  lastUpdated: legalConfig.lastUpdated,
  version: legalConfig.version,
  intro:
    "Ces conditions complètent les [conditions générales d’utilisation](/legale/terms). Elles expliquent comment commander, payer, recevoir et signaler un problème en tant qu’acheteur.",
  sections: [
    {
      id: "parcourir-et-commander",
      title: "Parcourir et commander",
      blocks: [
        "Vous pouvez découvrir les boutiques et les produits sans compte. L’inscription n’est demandée qu’au moment de commander ou d’ajouter un favori. Les acheteurs n’ont aucune vérification d’identité à faire.",
        "Les boutiques sont triées par distance à partir de la position de votre téléphone ou de l’adresse de livraison que vous choisissez. Si vous refusez l’accès à votre position, vous choisissez une adresse ou un quartier à la main.",
        "Vous ne voyez pas les boutiques dont la vérification n’est pas terminée, ni celles qui sont suspendues ou supprimées. Une boutique fermée reste visible avec la mention « Fermé », mais elle ne peut pas recevoir de commande.",
      ],
    },
    {
      id: "panier",
      title: "Le panier",
      blocks: [
        {
          list: [
            "Un panier par boutique : chaque panier donne une commande séparée.",
            "Vous pouvez changer les quantités, retirer un produit et écrire une note pour le vendeur.",
            "Les paniers sont conservés même si vous fermez l’application. Un produit devenu indisponible vous est signalé, avant le paiement.",
            "Un produit épuisé reste visible, mais vous ne pouvez pas le commander.",
          ],
        },
      ],
    },
    {
      id: "prix",
      title: "Prix et monnaies",
      blocks: [
        "Le prix affiché est le prix que vous payez : la livraison est toujours incluse, sans ligne « frais de livraison ». Chaque boutique fixe tous ses prix dans une seule monnaie, dollars ou francs congolais, et vous payez dans cette monnaie.",
        "L’équivalent dans l’autre monnaie est affiché à titre indicatif (« environ … francs, taux indicatif »), avec un taux de référence mis à jour chaque semaine par l’équipe SwiftGoma d’après le taux officiel de la Banque Centrale du Congo. Il n’est jamais utilisé pour convertir un paiement. Les dollars sont arrondis au centime et les francs aux 50 francs.",
      ],
    },
    {
      id: "codes-promo",
      title: "Codes promo",
      blocks: [
        {
          list: [
            "Un seul code par commande, saisi dans le panier ; la réduction s’affiche tout de suite.",
            "Si un code est refusé, l’application vous dit pourquoi : expiré, déjà utilisé ou montant minimum non atteint.",
            "Un code de vendeur est payé par le vendeur ; un code de SwiftGoma est payé par SwiftGoma. Dans les deux cas, vous payez le prix réduit affiché.",
          ],
        },
      ],
    },
    {
      id: "livraison-ou-retrait",
      title: "Livraison ou retrait",
      blocks: [
        "À chaque commande, vous choisissez d’être livré ou de venir chercher votre commande.",
        {
          list: [
            "**Livraison.** Proposée seulement si la boutique livre et que votre adresse se trouve dans sa zone. Vous choisissez votre adresse, et devez être joignable au moment de la livraison.",
            "**Retrait.** L’adresse et les horaires de la boutique sont affichés avant le paiement.",
          ],
        },
        "Les commandes sont toujours pour « le plus vite possible » : vous ne pouvez pas choisir un jour ou une heure.",
      ],
    },
    {
      id: "paiement",
      title: "Le paiement",
      blocks: [
        {
          steps: [
            "Vous vérifiez le récapitulatif : produits, réduction éventuelle, total à payer, adresse de livraison ou point de retrait.",
            "Vous choisissez votre numéro Mobile Money et confirmez le paiement sur votre téléphone avec votre code secret.",
            "Vous avez 5 minutes pour confirmer. Passé ce délai, le paiement est annulé.",
            "Dès que le paiement est confirmé, la commande est créée et le vendeur est prévenu.",
          ],
        },
        "Si le paiement échoue ou est annulé, la commande n’est pas créée et votre panier est conservé pour que vous puissiez réessayer.",
        {
          note: "Votre argent est retenu en sécurité. Il n’est versé au vendeur que lorsque vous confirmez avoir reçu votre commande, avec le code QR.",
        },
      ],
    },
    {
      id: "reponse-du-vendeur",
      title: "La réponse du vendeur",
      blocks: [
        {
          list: [
            "Le vendeur a 15 minutes pour accepter ou refuser votre commande.",
            "S’il refuse ou ne répond pas, vous êtes remboursé automatiquement et prévenu.",
            "S’il accepte, la commande passe « en préparation » et vous êtes prévenu.",
          ],
        },
      ],
    },
    {
      id: "annulation",
      title: "Annuler une commande",
      blocks: [
        {
          list: [
            "**Avant l’acceptation par le vendeur** : vous pouvez annuler et vous êtes remboursé automatiquement.",
            "**Après l’acceptation** : vous ne pouvez plus annuler seul. Signalez un problème, le Support examine votre demande.",
          ],
        },
      ],
    },
    {
      id: "suivi-et-qr",
      title: "Suivi et code QR",
      blocks: [
        "Vous suivez l’étape de votre commande en temps réel : en attente du vendeur, acceptée, en préparation, prête, en livraison, remise confirmée, terminée. Vous recevez une notification à chaque changement d’étape. Pendant une livraison, vous voyez le livreur avancer sur la carte.",
        { heading: "Le code QR de remise" },
        {
          list: [
            "Chaque commande a un code QR à usage unique, créé quand la commande est payée. Il se trouve dans le détail de votre commande.",
            "Montrez-le **à la réception de votre commande, pas avant**. Seul le livreur ou le vendeur de cette commande peut le scanner.",
            "Le scan confirme la remise. L’argent est alors réparti entre le vendeur, le livreur et SwiftGoma.",
            "Si le scan ne marche pas, vous pouvez dicter le code à 6 chiffres affiché sous le QR. Il ne fonctionne que pour le livreur ou le vendeur de la commande.",
          ],
        },
        { heading: "Acheteur absent ou scan oublié" },
        {
          list: [
            "Si vous êtes absent, le livreur vous attend 10 minutes et vous appelle, puis signale « acheteur absent ». La commande revient au vendeur, le livreur est payé du montant convenu, et le Support décide si vous êtes remboursé.",
            "Si le livreur annonce « arrivé » mais que le QR n’est pas scanné, vous recevez un message pour confirmer la réception. Sans réponse en 48 heures et sans problème signalé, la remise est confirmée automatiquement.",
          ],
        },
      ],
    },
    {
      id: "avis-et-problemes",
      title: "Avis et problèmes après la remise",
      blocks: [
        "Pendant 7 jours après la remise, vous pouvez :",
        {
          list: [
            "noter le vendeur, les produits et le livreur, et laisser un commentaire ;",
            "signaler un problème (article non reçu, abîmé, erroné, litige de paiement) depuis « Signaler un problème ». Le Support l’examine, puis un Admin décide si besoin.",
          ],
        },
        "Un remboursement est versé sur le moyen de paiement que vous avez utilisé. Tant qu’un litige est ouvert, l’argent concerné reste en attente. Voir aussi les [conditions générales](/legale/terms).",
      ],
    },
    {
      id: "vos-obligations",
      title: "Vos engagements",
      blocks: [
        {
          list: [
            "Donner une adresse exacte et rester joignable pour la livraison.",
            "Ne montrer votre code QR qu’à la réception, et ne jamais le transmettre avant.",
            "Ne pas abuser des remboursements, des signalements ou des codes promo.",
            "Respecter les vendeurs et les livreurs.",
          ],
        },
        `En cas de question, écrivez à ${email}.`,
      ],
    },
  ],
};
