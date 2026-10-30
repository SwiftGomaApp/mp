import { legalConfig } from "@/lib/legal/config";
import type { LegalDocument } from "@/lib/legal/types";

const email = `[${legalConfig.supportEmail}](mailto:${legalConfig.supportEmail})`;

export const sellerTerms: LegalDocument = {
  slug: "seller-terms",
  title: "Conditions vendeur",
  shortTitle: "Vendeurs",
  description:
    "Le contrat des vendeurs SwiftGoma : vérification, boutique et prix, commandes, paiement par code QR, commission, portefeuille, retraits et fin du contrat.",
  lastUpdated: legalConfig.lastUpdated,
  version: legalConfig.version,
  intro:
    "Ces conditions forment le contrat entre SwiftGoma et chaque vendeur. Elles complètent les [conditions générales d’utilisation](/legale/terms) et la [politique de confidentialité](/legale/privacy). Vous les acceptez dans l’application avant d’envoyer vos documents.",
  sections: [
    {
      id: "acceptation",
      title: "Acceptation du contrat",
      blocks: [
        "L’acceptation se fait dans l’application, sans papier : vous lisez le contrat, vous cochez « J’accepte » et vous saisissez un code reçu sur votre téléphone. SwiftGoma garde la date, l’heure et la version acceptées. Vous pouvez télécharger une copie en PDF.",
        "Le contrat est accepté au début de l’inscription vendeur, avant l’envoi des documents. Il devient actif lorsque votre dossier est approuvé.",
      ],
    },
    {
      id: "verification",
      title: "Vérification et documents",
      blocks: [
        "Un vendeur reçoit de l’argent et vend des marchandises. Pour protéger les acheteurs, SwiftGoma vérifie son identité avant que sa boutique soit visible.",
        { heading: "Documents demandés" },
        {
          list: [
            "pièce d’identité du propriétaire et un selfie ;",
            "registre de commerce ou autorisation d’exploitation ;",
            "numéro d’impôt ;",
            "photos de la boutique ;",
            "numéro Mobile Money de versement, qui doit être au même nom que la pièce d’identité.",
          ],
        },
        "Les informations que vous donnez doivent être exactes. Vous devez signaler tout changement.",
        { heading: "Les étapes du dossier" },
        {
          steps: [
            "Vous envoyez vos documents depuis l’application.",
            "Le dossier passe « en attente » dans la file du Support.",
            "Le Support vérifie que le selfie correspond à la pièce d’identité, que les documents sont lisibles et valides et que le numéro de versement est au même nom, puis donne son avis.",
            "Un Admin prend la décision finale : approuver ou refuser, avec une explication.",
            "Vous êtes prévenu à chaque étape par notification, SMS ou e-mail.",
          ],
        },
        "Si votre dossier est refusé, vous corrigez et vous renvoyez. Vous avez 3 essais, puis vous devez contacter le Support. Un dossier a cinq états possibles : non soumis, en attente, en examen, approuvé, refusé.",
        { heading: "Documents qui expirent" },
        "Certains documents ont une date de fin, comme l’autorisation d’exploitation. Vous recevez un rappel 30 jours avant. Si le document n’est pas remplacé à temps, votre compte est mis en pause jusqu’à l’envoi du nouveau document.",
        { heading: "Protection des documents" },
        "Vos documents sont gardés en privé et vus seulement par les personnes autorisées de l’équipe SwiftGoma. Chaque consultation est notée. Ils sont effacés après la suppression de votre compte, sauf si la loi oblige à les garder plus longtemps.",
      ],
    },
    {
      id: "conditions-pour-etre-actif",
      title: "Conditions pour être actif",
      blocks: [
        "Votre boutique devient visible quand toutes ces conditions sont remplies :",
        {
          list: [
            "dossier approuvé ;",
            "contrat accepté ;",
            "au moins un contact de récupération (e-mail ou téléphone) ajouté et vérifié ;",
            "numéro Mobile Money de versement ajouté et vérifié.",
          ],
        },
        "Tant qu’il en manque une, l’application vous montre ce qu’il reste à faire.",
      ],
    },
    {
      id: "boutique-et-produits",
      title: "Boutique et produits",
      blocks: [
        {
          list: [
            "Vous choisissez la catégorie de votre boutique en la créant. Les catégories sont gérées par SwiftGoma.",
            "Vous ne pouvez vendre que ce qui est permis par la loi et par la plateforme.",
            "Vous décrivez vos produits avec exactitude : photos, nom, description, variantes, prix et disponibilité.",
            "Vous tenez votre stock à jour. Un produit épuisé reste visible mais ne peut pas être commandé.",
            "Vous indiquez vos horaires d’ouverture. Une boutique fermée ne peut pas recevoir de commande.",
          ],
        },
      ],
    },
    {
      id: "prix",
      title: "Prix",
      blocks: [
        "Le prix affiché dans l’application ne doit pas dépasser le prix que vous pratiquez en boutique ou au marché. L’acheteur le paie en entier, livraison comprise : il n’y a pas de ligne « frais de livraison ».",
        "Vous fixez tous vos prix dans une seule monnaie, dollars ou francs congolais, et l’acheteur paie dans cette monnaie. L’équivalent dans l’autre monnaie est affiché à titre indicatif et n’est jamais utilisé pour convertir un paiement.",
      ],
    },
    {
      id: "commandes",
      title: "Les commandes",
      blocks: [
        {
          list: [
            "Vous êtes prévenu dès qu’une commande est payée. Vous avez **15 minutes** pour l’accepter ou la refuser ; un rappel vous est envoyé à 5 minutes.",
            "Si vous refusez ou ne répondez pas, l’acheteur est remboursé automatiquement.",
            "Une fois la commande acceptée, vous la préparez, puis vous la marquez « prête ».",
            "Pour un retrait, l’acheteur est prévenu et, à son arrivée, vous scannez son code QR.",
            "Vous ne pouvez pas commander dans votre propre boutique.",
          ],
        },
        "L’acheteur peut annuler tant que vous n’avez pas accepté. Ensuite, il doit signaler un problème au Support.",
      ],
    },
    {
      id: "livraison",
      title: "Livraison",
      blocks: [
        "Vous décidez si votre boutique propose la livraison et dans quelles zones. Pour livrer, vous travaillez avec des livreurs indépendants reliés à votre boutique.",
        {
          list: [
            "Un livreur vous envoie une demande de liaison ; elle n’est active qu’après votre acceptation. Vous pouvez le retirer de votre boutique à tout moment.",
            "Quand une commande est prête, vous choisissez un livreur relié à votre boutique et le **montant convenu** avec lui. Le livreur confirme ce montant avant de partir.",
            "Le montant convenu avec le livreur est retiré de votre part, après la commission.",
          ],
        },
      ],
    },
    {
      id: "paiement-et-qr",
      title: "Paiement et code QR",
      blocks: [
        "L’argent de l’acheteur est retenu en sécurité. Il n’est jamais dans votre portefeuille tant que le code QR n’est pas scanné.",
        {
          steps: [
            "L’acheteur paie en ligne. L’argent est retenu.",
            "Vous acceptez la commande, la préparez, puis la remettez (livraison ou retrait).",
            "L’acheteur montre son code QR, qui est scanné par le livreur ou par vous.",
            "L’argent est réparti : la commission va à SwiftGoma, le montant convenu va au livreur en cas de livraison, et le reste va dans votre portefeuille.",
          ],
        },
        "Si le QR n’est pas scanné mais que le livreur annonce « arrivé », l’acheteur reçoit un message pour confirmer la réception. Sans réponse en 48 heures et sans problème signalé, la remise est confirmée automatiquement.",
      ],
    },
    {
      id: "promotions",
      title: "Codes promo",
      blocks: [
        "Quand vous créez un code promo, la réduction est payée par vous, et la commission de SwiftGoma se calcule sur le prix après réduction. Quand l’acheteur utilise un code de SwiftGoma, la réduction est payée par SwiftGoma : vous recevez la même somme que sans code.",
      ],
    },
    {
      id: "commission",
      title: "Commission",
      blocks: [
        "SwiftGoma prélève une commission sur chaque commande remise. Elle est décrite dans l’annexe en bas de cette page, que SwiftGoma peut mettre à jour avec un préavis de 30 jours.",
      ],
    },
    {
      id: "portefeuille",
      title: "Portefeuille et retraits",
      blocks: [
        {
          list: [
            "**Deux soldes.** Votre portefeuille a un solde en dollars et un solde en francs congolais. SwiftGoma ne convertit pas l’argent : une commande en francs crédite le solde en francs, une commande en dollars crédite le solde en dollars.",
            "**Solde en attente.** Après le scan du QR, l’argent reste en attente pendant 24 heures, pour laisser le temps à l’acheteur de signaler un problème. Ensuite il devient disponible.",
            "**Litige.** Si un litige est ouvert sur une commande, l’argent concerné reste en attente jusqu’à la décision.",
            "**Retrait.** Vous retirez votre solde disponible sur votre numéro Mobile Money de versement, vérifié et au même nom que votre pièce d’identité. Un nouveau code est demandé pour confirmer chaque retrait.",
            "**Limites et frais.** Un minimum, un maximum et un plafond par jour existent dans chaque monnaie. Le fournisseur de paiement prélève des frais sur chaque retrait ; avant de confirmer, l’application affiche le montant demandé, les frais et le montant reçu.",
            "**Statuts.** Demandé, envoyé, réussi ou échoué. Si le retrait échoue, l’argent revient dans votre portefeuille.",
          ],
        },
        { heading: "Remboursements et solde négatif" },
        "Si un acheteur est remboursé après le versement dans votre portefeuille, le montant est retiré de votre portefeuille et votre solde peut devenir négatif. Tant qu’il est négatif, vous ne pouvez pas retirer : vos prochaines ventes le remplissent d’abord.",
        { heading: "Sécurité" },
        {
          list: [
            "Un retrait peut être mis en pause si une alerte de fraude se déclenche. Vous êtes prévenu et pouvez contacter le Support.",
            "Changer votre numéro de versement demande un nouveau code. Après une récupération de compte, ce numéro est verrouillé pendant 72 heures et les retraits sont bloqués pendant cette durée.",
          ],
        },
      ],
    },
    {
      id: "litiges",
      title: "Remboursements et litiges",
      blocks: [
        "Un acheteur peut signaler un problème pendant 7 jours après la remise. Le Support examine le dossier à partir de l’historique de la commande ; ce qui dépasse sa limite est décidé par un Admin. Vous êtes informé du résultat.",
        "Si un remboursement est décidé, il est versé à l’acheteur sur son moyen de paiement. Si l’argent vous avait déjà été versé, il est retiré de votre portefeuille.",
      ],
    },
    {
      id: "suspension-et-fin",
      title: "Suspension et fin du contrat",
      blocks: [
        {
          list: [
            "SwiftGoma peut suspendre ou bannir un compte qui ne respecte pas les règles : informations fausses, produits interdits, fraude, comportement abusif ou documents expirés. Vous êtes alors déconnecté de tous vos appareils.",
            "Vous pouvez écrire au Support depuis l’écran de connexion ; l’équipe examine votre demande et un Admin décide.",
            "Vous pouvez mettre fin au contrat en supprimant votre compte depuis votre profil. La suppression est refusée tant qu’une commande est en cours, qu’un litige est ouvert ou qu’un versement est attendu ; la boutique disparaît des recherches dès la désactivation du compte.",
          ],
        },
      ],
    },
    {
      id: "modifications",
      title: "Modification du contrat",
      blocks: [
        "Quand le contrat change, vous êtes prévenu 30 jours à l’avance et vous devez accepter la nouvelle version pour continuer. Si vous la refusez, vous pouvez quitter la plateforme.",
      ],
    },
    {
      id: "annexe-commission",
      title: "Annexe : commission",
      blocks: [
        "La commission est calculée par commande, sur le total des produits après réduction, selon le montant de la commande :",
        {
          table: {
            head: ["Total des produits de la commande", "Commission"],
            rows: [
              ["Moins de 20 $, ou l’équivalent en francs congolais", "12 %"],
              ["De 20 $ à 100 $, ou l’équivalent en francs congolais", "8 %"],
              ["Plus de 100 $, ou l’équivalent en francs congolais", "5 %"],
            ],
          },
        },
        "Le pourcentage est le même en dollars et en francs congolais ; les seuils existent dans les deux monnaies. Cette annexe peut être mise à jour par SwiftGoma avec un préavis de 30 jours.",
        `Une question sur ce contrat ? Écrivez-nous à ${email}.`,
      ],
    },
  ],
};
