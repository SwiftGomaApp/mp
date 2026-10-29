import type { LegalContent } from "../types";

/**
 * Written from the "SwiftGoma MarketPlace" specification and from what the server really does
 * (data it stores, retention periods, limits). To be reviewed by a lawyer before the launch: the
 * retention periods, the legal entity, the governing law and the contact details are the points
 * the specification itself says must be confirmed.
 */
export const legalFr: LegalContent = {
  terms: {
    title: "Conditions d'utilisation",
    version: "1.0",
    intro:
      "Ces conditions décrivent les règles d'utilisation de SwiftGoma MarketPlace, la place de marché de Goma. En créant un compte, vous les acceptez.",
    sections: [
      {
        heading: "Ce qu'est SwiftGoma",
        body: [
          "SwiftGoma est une application où les habitants de Goma découvrent les boutiques de leur ville, choisissent des produits, paient en ligne puis se font livrer ou viennent récupérer leur commande.",
          "Les produits sont proposés par des vendeurs et apportés par des livreurs indépendants, vérifiés par SwiftGoma. Une équipe SwiftGoma surveille la plateforme, vérifie les comptes et aide à résoudre les problèmes.",
        ],
      },
      {
        heading: "Qui peut s'inscrire",
        bullets: [
          "Il faut avoir **au moins 18 ans**. Vous confirmez votre âge en cochant une case à l'inscription.",
          "Seuls les numéros de téléphone de la RDC, qui commencent par +243, sont acceptés.",
          "Chaque compte a un seul rôle : acheteur, vendeur ou livreur. Un vendeur peut aussi commander chez d'autres vendeurs, mais pas dans sa propre boutique.",
          "Une inscription qui n'est pas confirmée en 3 jours est supprimée.",
        ],
      },
      {
        heading: "Votre compte et vos connexions",
        bullets: [
          "Vous pouvez vous connecter par e-mail ou par téléphone avec un code, par e-mail et mot de passe, avec Google, avec Apple, ou avec l'empreinte ou le visage.",
          "Si un e-mail ou un numéro est déjà vérifié sur un compte, il est relié à ce compte au lieu d'en créer un nouveau.",
          "Vous restez connecté tant que vous utilisez l'application. Si vous ne l'ouvrez plus pendant 7 jours, vous devez vous reconnecter.",
          "Un compte peut être utilisé sur 5 appareils au plus. À la sixième connexion, l'appareil le plus ancien est déconnecté.",
          "Vous pouvez vous déconnecter d'un seul appareil ou de tous à la fois.",
          "La double vérification, avec un code qui change toutes les 30 secondes, est facultative pour vous. Nous la recommandons.",
        ],
      },
      {
        heading: "La sécurité de votre compte",
        bullets: [
          "Ne donnez jamais vos codes à personne. Un code reçu par e-mail ou par SMS ne sert qu'une fois et expire après quelques minutes.",
          "Pour limiter les abus, un même numéro ou une même adresse e-mail ne peut recevoir que 5 codes par heure, avec 60 secondes d'attente entre deux envois.",
          "Un nouveau code est demandé avant de changer votre numéro de téléphone, votre adresse e-mail, votre mot de passe ou votre numéro Mobile Money.",
          "Vous êtes prévenu à chaque connexion depuis un nouvel appareil, et à chaque changement de mot de passe ou de contact. Ces alertes ne peuvent pas être désactivées.",
          "Si votre téléphone est perdu ou volé, déconnectez tous vos appareils depuis la sécurité de votre compte ou contactez le Support.",
        ],
      },
      {
        heading: "Commandes et paiement",
        note: "Quand vous payez, votre argent est retenu en sécurité. Il n'est versé au vendeur qu'une fois que vous avez confirmé la réception de votre commande en montrant votre code QR.",
        body: [
          "Si la commande est refusée, annulée ou remboursée avant la remise, vous récupérez votre argent.",
          "Les règles détaillées des achats, des prix, de la livraison et des remboursements se trouvent dans les Conditions Acheteur.",
        ],
      },
      {
        heading: "Ce que nous attendons de vous",
        bullets: [
          "Donner des informations exactes et les garder à jour.",
          "Ne pas utiliser le compte d'une autre personne.",
          "Respecter les vendeurs, les livreurs et l'équipe SwiftGoma.",
          "Ne pas tenter de tromper la plateforme, par exemple avec de faux paiements ou de faux avis.",
        ],
      },
      {
        heading: "Compte suspendu",
        body: [
          "Si un compte ne respecte pas les règles, l'équipe SwiftGoma peut le suspendre ou le bannir. La personne est alors déconnectée de tous ses appareils immédiatement et ne peut plus se reconnecter.",
          "Elle peut écrire au Support depuis l'écran de connexion : l'équipe examine sa demande et un Admin décide.",
        ],
      },
      {
        heading: "Supprimer votre compte",
        body: [
          "Vous pouvez supprimer votre compte depuis votre profil, après avoir confirmé avec un nouveau code. La suppression est refusée s'il reste une commande en cours, un litige ouvert ou un paiement en attente.",
          "Le compte est désactivé tout de suite et vous êtes déconnecté de tous vos appareils. Pendant 30 jours, vous pouvez annuler en vous reconnectant. Après 30 jours, la suppression est définitive.",
          "Avant de supprimer, vous pouvez télécharger une copie de vos informations. Ce qui est effacé et ce qui est gardé est expliqué dans la Politique de confidentialité.",
        ],
      },
      {
        heading: "Modifications des conditions",
        body: [
          "SwiftGoma peut modifier ces conditions. La version que vous acceptez, avec la date de votre acceptation, est conservée. En cas de changement important, vous en êtes informé dans l'application.",
        ],
      },
      {
        heading: "Contact et droit applicable",
        body: [
          "Pour toute question, écrivez-nous à support@swiftgoma.com.",
          "Ces conditions sont soumises au droit de la République démocratique du Congo.",
        ],
      },
    ],
  },

  privacy: {
    title: "Politique de confidentialité",
    version: "1.0",
    intro:
      "Cette politique explique quelles informations SwiftGoma collecte, pourquoi, avec qui elles sont partagées, combien de temps elles sont conservées, et quels sont vos droits.",
    sections: [
      {
        heading: "Les informations que nous collectons",
        bullets: [
          "**Votre identité** : votre nom, votre adresse e-mail, votre numéro de téléphone et votre rôle.",
          "**Votre connexion avec Google ou Apple** : l'identifiant de votre compte, votre adresse e-mail et votre nom, tels que Google ou Apple nous les transmettent.",
          "**Votre empreinte ou votre visage** : nous ne les recevons jamais. Votre téléphone les reconnaît lui-même et nous garde seulement une clé de sécurité publique.",
          "**Vos appareils** : un identifiant créé par l'application, le modèle du téléphone, le système (Android, iOS ou web), l'adresse IP et la ville et le pays approximatifs qui en sont déduits.",
          "**Votre activité** : chaque connexion (date, heure, appareil, méthode, réussite ou échec) et chaque changement de sécurité.",
          "**Vos achats** : vos commandes, vos paniers, vos adresses de livraison, votre numéro Mobile Money, vos favoris et vos avis.",
          "**Votre position** : seulement si vous l'autorisez, pour trouver les boutiques proches de vous. Vous pouvez la refuser et choisir une adresse à la main.",
          "**Votre acceptation** : la date et la version des conditions que vous avez acceptées, et la confirmation que vous avez **au moins 18 ans**.",
          "**Si vous demandez la récupération de votre compte à l'équipe** : un selfie et une photo de votre pièce d'identité.",
        ],
      },
      {
        heading: "Pourquoi nous les utilisons",
        bullets: [
          "Créer votre compte, vérifier votre identité et protéger votre accès.",
          "Traiter vos commandes, vos paiements et vos livraisons.",
          "Vous envoyer des codes et des alertes de sécurité, et les notifications que vous avez choisies.",
          "Prévenir la fraude et les abus.",
          "Vous aider quand vous contactez le Support ou en cas de litige.",
          "Respecter nos obligations légales, par exemple de comptabilité.",
        ],
      },
      {
        heading: "Avec qui nous les partageons",
        bullets: [
          "**Les vendeurs** reçoivent ce qu'il faut pour préparer votre commande : le contenu de la commande, votre nom et, pour une livraison, votre adresse.",
          "**Les livreurs** reçoivent l'adresse de la boutique et la vôtre, les produits, et peuvent vous appeler. Vous voyez leur position pendant la livraison.",
          "**Les services de paiement Mobile Money** traitent votre paiement.",
          "**Des services d'envoi de SMS et d'e-mails** nous aident à vous envoyer vos codes et vos messages.",
          "**Google et Apple**, si vous vous connectez avec eux.",
          "**Un service de suivi des erreurs techniques** de l'application.",
          "**Les membres autorisés de l'équipe SwiftGoma**, pour la vérification des comptes et le Support. Chaque consultation de documents est notée.",
        ],
        note: "Nous ne vendons pas vos informations.",
      },
      {
        heading: "Combien de temps nous les gardons",
        bullets: [
          "Une inscription non confirmée est supprimée au bout de **3 jours**.",
          "Les anciennes connexions (appareils fermés ou expirés) sont supprimées après **30 jours**.",
          "Le journal d'activité est gardé **1 an**. Vous voyez dans l'application les **90 derniers jours**.",
          "Après la suppression de votre compte, vous avez **30 jours** pour annuler. Ensuite, votre profil, vos contacts, vos appareils, vos adresses, vos favoris et les documents d'identité envoyés pour une vérification sont effacés.",
          "Vos commandes et paiements passés sont gardés sans votre nom, pour la comptabilité et les litiges éventuels. Vos avis restent visibles sans votre nom.",
          "Votre e-mail et votre numéro sont libérés : vous pouvez vous réinscrire avec les mêmes, mais vous retrouvez un compte vide.",
        ],
      },
      {
        heading: "Comment nous protégeons vos informations",
        bullets: [
          "Votre mot de passe n'est jamais conservé tel quel : même l'équipe SwiftGoma ne peut pas le lire.",
          "Les codes reçus par e-mail ou SMS ne servent qu'une fois et expirent vite.",
          "Les documents d'identité sont gardés en privé et vus seulement par les personnes autorisées.",
          "Chaque connexion, échec ou changement de sécurité est noté, pour retrouver ce qui s'est passé en cas de problème.",
          "Un nouveau code est demandé pour les actions sensibles, même si vous êtes déjà connecté.",
        ],
      },
      {
        heading: "Vos droits",
        bullets: [
          "Voir et corriger vos informations : votre nom, votre photo, votre e-mail, votre téléphone et vos adresses depuis votre profil.",
          "Télécharger une copie de vos informations : profil, adresses, historique de commandes, favoris et avis. Vous la recevez sur votre contact principal, après une nouvelle vérification.",
          "Supprimer votre compte depuis votre profil.",
          "Choisir les notifications que vous recevez, et accepter ou refuser les offres et les promotions. Les messages de sécurité restent toujours actifs.",
          "Retirer l'accès à votre position dans les réglages de votre téléphone.",
        ],
        body: [
          "Pour exercer un droit ou poser une question, écrivez-nous à support@swiftgoma.com.",
        ],
      },
      {
        heading: "Enfants",
        body: [
          "SwiftGoma est réservé aux personnes de **18 ans ou plus**. Nous ne collectons pas sciemment d'informations sur des mineurs. Si nous apprenons qu'un compte appartient à un mineur, il peut être supprimé.",
        ],
      },
      {
        heading: "Modifications de cette politique",
        body: [
          "Nous pouvons mettre à jour cette politique. La version que vous acceptez, avec la date, est conservée. En cas de changement important, vous en êtes informé dans l'application.",
        ],
      },
    ],
  },

  buyerTerms: {
    title: "Conditions Acheteur",
    version: "1.0",
    intro:
      "Ces conditions s'ajoutent aux Conditions d'utilisation. Elles expliquent comment fonctionnent vos achats sur SwiftGoma, du panier jusqu'à la remise de votre commande.",
    sections: [
      {
        heading: "Parcourir et commander",
        bullets: [
          "Vous pouvez parcourir les boutiques et les produits sans compte. Il faut vous connecter ou vous inscrire pour commander ou ajouter un favori.",
          "Vous avez un panier par boutique, et chaque panier donne une commande séparée.",
          "Vous pouvez écrire une note pour le vendeur. Un produit devenu indisponible vous est signalé avant le paiement.",
          "Les commandes sont toujours pour « le plus vite possible » : vous ne pouvez pas choisir un jour ou une heure.",
        ],
      },
      {
        heading: "Les prix",
        bullets: [
          "Le prix affiché est le prix que vous payez. La livraison est toujours incluse : il n'y a pas de ligne « frais de livraison ».",
          "Chaque boutique fixe tous ses prix dans une seule monnaie, dollars ou francs congolais, et vous payez dans cette monnaie.",
          "L'équivalent dans l'autre monnaie est donné à titre indicatif, avec un taux de référence mis à jour chaque semaine d'après le taux officiel de la Banque Centrale du Congo. Il ne sert jamais à convertir un paiement.",
          "Les montants en dollars sont arrondis au centime, et ceux en francs aux 50 francs.",
          "Les vendeurs s'engagent à ne pas afficher un prix plus élevé que celui pratiqué en boutique ou au marché.",
        ],
      },
      {
        heading: "Livraison ou retrait",
        bullets: [
          "À chaque commande, vous choisissez d'être livré ou de venir chercher votre commande.",
          "La livraison n'est proposée que si la boutique livre à votre adresse. Sinon, la boutique reste visible avec la mention « Ne livre pas chez vous », et le retrait reste possible.",
          "Pour un retrait, l'adresse et les horaires de la boutique sont affichés. Une boutique fermée ne peut pas recevoir de commande.",
          "Les livreurs sont indépendants et vérifiés par SwiftGoma. Pendant la livraison, vous suivez leur position sur la carte.",
        ],
      },
      {
        heading: "Codes promo",
        bullets: [
          "Vous pouvez utiliser un seul code promo par commande. La réduction s'affiche tout de suite.",
          "Un code refusé est expliqué : expiré, déjà utilisé, ou montant minimum non atteint.",
          "Si le code vient d'un vendeur, la réduction est payée par le vendeur. S'il vient de SwiftGoma, elle est payée par SwiftGoma.",
        ],
      },
      {
        heading: "Le paiement",
        note: "Votre argent est retenu en sécurité. Il n'est versé au vendeur qu'au scan de votre code QR.",
        bullets: [
          "Vous payez par Mobile Money : vous choisissez votre numéro, confirmez sur votre téléphone avec votre code secret, puis vous attendez la confirmation. Le paiement par carte bancaire sera proposé plus tard.",
          "Vous avez 5 minutes pour confirmer sur votre téléphone. Passé ce délai, le paiement est annulé.",
          "Si le paiement échoue ou est annulé, la commande n'est pas créée et votre panier est conservé pour réessayer.",
        ],
      },
      {
        heading: "La réponse du vendeur et l'annulation",
        bullets: [
          "Le vendeur a 15 minutes pour accepter ou refuser votre commande.",
          "S'il refuse ou ne répond pas, vous êtes remboursé automatiquement et prévenu.",
          "Avant l'acceptation, vous pouvez annuler et vous êtes remboursé automatiquement.",
          "Après l'acceptation, vous ne pouvez plus annuler seul : signalez un problème et le Support examine.",
        ],
      },
      {
        heading: "Le code QR de remise",
        bullets: [
          "Un code QR est créé pour chaque commande payée. Il ne fonctionne qu'une fois, et seul le livreur ou le vendeur de cette commande peut le scanner.",
          "Montrez-le à la réception de votre commande, pas avant. Le scan confirme la remise et déclenche le paiement du vendeur.",
          "Si le scan ne marche pas, vous pouvez dicter le code à 6 chiffres affiché sous le QR.",
          "Si vous êtes absent, le livreur attend 10 minutes et vous appelle, puis signale « acheteur absent ». La commande revient au vendeur et le Support décide si vous êtes remboursé.",
          "Si le livreur annonce « arrivé » sans scanner le QR, vous recevez un message pour confirmer la réception. Sans réponse en 48 heures et sans problème signalé, la remise est confirmée automatiquement.",
        ],
      },
      {
        heading: "Après la remise",
        bullets: [
          "Pendant 7 jours, vous pouvez noter le vendeur, les produits et le livreur, et laisser un commentaire. Vous choisissez le nom affiché dans vos avis : nom complet, prénom avec l'initiale, ou anonyme.",
          "Pendant 7 jours, vous pouvez aussi signaler un problème. Le Support l'examine.",
          "L'argent du vendeur reste en attente 24 heures après le scan, pour vous laisser le temps de signaler un problème. Si un litige est ouvert, il reste en attente jusqu'à la décision du Support ou d'un Admin.",
        ],
      },
      {
        heading: "Remboursements",
        body: [
          "Un remboursement retourne sur le moyen de paiement que vous avez utilisé. Il est automatique quand le vendeur refuse la commande, ne répond pas, ou quand vous annulez avant l'acceptation. Dans les autres cas, le Support examine votre demande et décide.",
        ],
      },
      {
        heading: "Vos engagements",
        bullets: [
          "Donner une adresse exacte et être joignable au moment de la livraison.",
          "Ne montrer votre code QR qu'à la réception de votre commande.",
          "Respecter les vendeurs et les livreurs.",
          "Ne pas signaler de faux problèmes pour obtenir un remboursement.",
        ],
      },
    ],
  },
};
