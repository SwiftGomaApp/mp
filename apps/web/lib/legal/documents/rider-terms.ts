import { legalConfig } from "@/lib/legal/config";
import type { LegalDocument } from "@/lib/legal/types";

const email = `[${legalConfig.supportEmail}](mailto:${legalConfig.supportEmail})`;

export const riderTerms: LegalDocument = {
  slug: "rider-terms",
  title: "Conditions livreur",
  shortTitle: "Livreurs",
  description:
    "Le contrat des livreurs SwiftGoma : statut indépendant, vérification, liaison avec les boutiques, règles de livraison, code QR, paiement et fin du contrat.",
  lastUpdated: legalConfig.lastUpdated,
  version: legalConfig.version,
  intro:
    "Ces conditions forment le contrat entre SwiftGoma et chaque livreur. Elles complètent les [conditions générales d’utilisation](/legale/terms) et la [politique de confidentialité](/legale/privacy). Vous les acceptez dans l’application avant d’envoyer vos documents.",
  sections: [
    {
      id: "acceptation",
      title: "Acceptation du contrat",
      blocks: [
        "L’acceptation se fait dans l’application, sans papier : vous lisez le contrat, vous cochez « J’accepte » et vous saisissez un code reçu sur votre téléphone. SwiftGoma garde la date, l’heure et la version acceptées. Vous pouvez télécharger une copie en PDF.",
        "Le contrat est accepté au début de l’inscription livreur, avant l’envoi des documents. Il devient actif lorsque votre dossier est approuvé.",
      ],
    },
    {
      id: "statut",
      title: "Votre statut de livreur indépendant",
      blocks: [
        {
          list: [
            "Vous n’êtes **pas employé** de SwiftGoma ni d’une boutique.",
            "Vous pouvez travailler avec plusieurs boutiques à la fois.",
            "Vous organisez votre travail librement, dans le respect des règles de livraison ci-dessous.",
            "Vous créez vous-même votre compte livreur depuis l’application.",
          ],
        },
      ],
    },
    {
      id: "verification",
      title: "Vérification et documents",
      blocks: [
        "Un livreur transporte des marchandises pour les acheteurs. Pour les protéger, SwiftGoma vérifie votre identité avant de vous laisser travailler.",
        { heading: "Documents demandés" },
        {
          list: [
            "pièce d’identité et un selfie ;",
            "permis de conduire (moto ou voiture) ;",
            "photo du véhicule et de sa plaque.",
          ],
        },
        { heading: "Les étapes du dossier" },
        {
          steps: [
            "Vous envoyez vos documents depuis l’application.",
            "Le dossier passe « en attente » dans la file du Support.",
            "Le Support vérifie que le selfie correspond à la pièce d’identité et que les documents sont lisibles et valides, puis donne son avis.",
            "Un Admin prend la décision finale : approuver ou refuser, avec une explication.",
            "Vous êtes prévenu à chaque étape par notification, SMS ou e-mail.",
          ],
        },
        "Si votre dossier est refusé, vous corrigez et vous renvoyez. Vous avez 3 essais, puis vous devez contacter le Support. Tant que votre dossier n’est pas approuvé, vous ne pouvez ni être relié à une boutique ni recevoir de livraison.",
        { heading: "Documents qui expirent" },
        "Le permis de conduire a une date de fin. Vous recevez un rappel 30 jours avant. Si le document n’est pas remplacé à temps, votre compte est mis en pause jusqu’à l’envoi du nouveau document.",
        { heading: "Protection des documents" },
        "Vos documents sont gardés en privé et vus seulement par les personnes autorisées de l’équipe SwiftGoma. Chaque consultation est notée. Ils sont effacés après la suppression de votre compte, sauf si la loi oblige à les garder plus longtemps.",
      ],
    },
    {
      id: "liaison-boutiques",
      title: "Être relié à une boutique",
      blocks: [
        "Quand votre dossier est approuvé et votre contrat accepté, vous pouvez travailler avec des boutiques :",
        {
          list: [
            "**Demande.** Vous choisissez une boutique et lui envoyez une demande de liaison. Le nombre de demandes en attente est limité, et après un refus vous devez attendre avant de redemander la même boutique.",
            "**Acceptation.** Le vendeur accepte ou refuse. La liaison n’est active qu’après son acceptation.",
            "**Plusieurs boutiques.** Vous pouvez être relié à plusieurs boutiques à la fois.",
            "**Fin de la liaison.** Le vendeur peut vous retirer de sa boutique, et vous pouvez la quitter, à tout moment.",
          ],
        },
      ],
    },
    {
      id: "regles-de-livraison",
      title: "Règles de livraison",
      blocks: [
        {
          steps: [
            "Vous recevez la demande avec l’adresse de la boutique, celle de l’acheteur, les produits et le montant convenu, et vous la confirmez avant de partir.",
            "Vous récupérez la commande à la boutique.",
            "Vous partez vers l’acheteur. Votre position est partagée en direct.",
            "Vous arrivez et appelez l’acheteur si besoin.",
            "Vous scannez le code QR de l’acheteur pour confirmer la remise.",
          ],
        },
        { heading: "Ce que vous vous engagez à faire" },
        {
          list: [
            "**Scanner le QR.** Le scan est obligatoire pour confirmer la remise. L’acheteur ne le montre qu’à la réception ; s’il ne marche pas, il peut vous dicter le code à 6 chiffres affiché sous le QR.",
            "**Prendre soin du colis.** Vous êtes responsable de la commande pendant le trajet, de la boutique jusqu’à l’acheteur.",
            "**Respecter les clients.** Vous êtes poli et respectueux avec les acheteurs et les vendeurs.",
            "**Livrer vous-même.** Vous ne confiez pas la commande à quelqu’un d’autre.",
          ],
        },
        { heading: "Si l’acheteur est absent" },
        "Vous attendez 10 minutes et vous appelez l’acheteur, puis vous signalez « acheteur absent ». La commande revient au vendeur et vous êtes payé du montant convenu. Le Support décide ensuite si l’acheteur est remboursé.",
      ],
    },
    {
      id: "position",
      title: "Partage de votre position",
      blocks: [
        "Vous acceptez de partager votre position pendant les livraisons, pour que l’acheteur voie sa commande avancer sur la carte et que la boutique puisse suivre la course. Le partage se limite aux livraisons en cours. Pour en savoir plus, consultez la [politique de confidentialité](/legale/privacy).",
      ],
    },
    {
      id: "paiement",
      title: "Votre paiement",
      blocks: [
        {
          list: [
            "Vous êtes payé pour chaque livraison réussie, **100 %** du montant convenu avec la boutique et confirmé par vous avant le départ.",
            "Le montant est versé dans votre portefeuille SwiftGoma, dans la monnaie de la commande. SwiftGoma ne convertit pas l’argent entre dollars et francs congolais.",
            "Après le scan du QR, l’argent reste en attente pendant 24 heures, puis devient disponible.",
            "Vous retirez votre solde disponible sur votre numéro Mobile Money, avec un nouveau code pour confirmer chaque retrait. Un minimum, un maximum et un plafond par jour existent dans chaque monnaie, et le fournisseur de paiement prélève des frais affichés avant la confirmation.",
            "Un retrait peut être mis en pause si une alerte de fraude se déclenche. Après une récupération de compte, les retraits sont bloqués pendant 72 heures.",
          ],
        },
        "Si un litige est ouvert sur une commande, l’argent concerné reste en attente jusqu’à la décision du Support ou d’un Admin.",
      ],
    },
    {
      id: "suspension-et-fin",
      title: "Suspension et fin du contrat",
      blocks: [
        {
          list: [
            "SwiftGoma peut suspendre ou bannir un compte qui ne respecte pas les règles : documents faux ou expirés, commande non remise, comportement abusif ou fraude. Vous êtes alors déconnecté de tous vos appareils.",
            "Vous pouvez écrire au Support depuis l’écran de connexion ; l’équipe examine votre demande et un Admin décide.",
            "Vous pouvez mettre fin au contrat en supprimant votre compte depuis l’application. La suppression est refusée tant qu’une livraison est en cours ou qu’un litige est ouvert.",
          ],
        },
      ],
    },
    {
      id: "modifications",
      title: "Modification du contrat",
      blocks: [
        "Quand le contrat change, vous êtes prévenu 30 jours à l’avance et vous devez accepter la nouvelle version pour continuer. Si vous la refusez, vous pouvez quitter la plateforme.",
        `Une question sur ce contrat ? Écrivez-nous à ${email}.`,
      ],
    },
  ],
};
