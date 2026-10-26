const { renderLayout, textFooter, styles, FONT, BRAND_COLOR } = require("./layout");
const { escapeHtml } = require("./escape");

const INTRO =
  "SwiftGoma MarketPlace est la place de marché de Goma, accessible depuis votre téléphone. Les habitants y découvrent les boutiques de leur ville, paient en ligne avec Mobile Money, puis se font livrer ou viennent récupérer leur commande. Votre argent reste en sécurité jusqu'à la réception de la commande, confirmée par un code QR.";

const GUIDES = {
  BUYER: {
    title: "Comment acheter sur SwiftGoma",
    steps: [
      [
        "Découvrez les boutiques",
        "Parcourez les boutiques proches de vous, par catégorie ou avec la recherche.",
      ],
      [
        "Remplissez votre panier",
        "Chaque boutique a son propre panier. Choisissez ensuite la livraison ou le retrait en boutique.",
      ],
      [
        "Payez avec Mobile Money",
        "Confirmez le paiement sur votre téléphone dans les 5 minutes. Votre argent est retenu en sécurité.",
      ],
      [
        "Suivez votre commande",
        "Le vendeur a 15 minutes pour répondre. Vous êtes prévenu à chaque étape, et vous suivez le livreur en direct.",
      ],
      [
        "Montrez votre code QR à la réception",
        "Vous le trouvez dans le détail de la commande. Le vendeur n'est payé qu'après le scan. Vous avez ensuite 7 jours pour noter votre commande ou signaler un problème.",
      ],
    ],
    tip: "Conseil : ajoutez un contact de récupération dans la sécurité du compte, pour retrouver votre accès si vous perdez votre téléphone.",
  },
  SELLER: {
    title: "Comment vendre sur SwiftGoma",
    steps: [
      [
        "Envoyez vos documents",
        "Pièce d'identité et selfie, registre de commerce ou autorisation d'exploitation, numéro d'impôt, photos de la boutique, et votre numéro Mobile Money de versement (à votre nom).",
      ],
      [
        "Acceptez le contrat vendeur",
        "L'acceptation se fait dans l'application, avec un code reçu sur votre téléphone.",
      ],
      [
        "Ajoutez un contact de récupération",
        "Il est obligatoire avant que votre boutique soit visible.",
      ],
      [
        "Créez votre boutique et vos produits",
        "Fixez vos prix dans une seule monnaie (dollars ou francs congolais), livraison incluse.",
      ],
      [
        "Répondez vite aux commandes",
        "Vous avez 15 minutes pour accepter ou refuser. Sans réponse, l'acheteur est remboursé.",
      ],
      [
        "Remettez la commande et faites scanner le QR",
        "Après le scan, l'argent arrive dans votre portefeuille (moins la commission SwiftGoma). Il devient disponible après 24 heures, et vous le retirez sur votre Mobile Money.",
      ],
    ],
    tip: "Votre boutique sera visible dès que votre dossier sera approuvé par l'équipe SwiftGoma.",
  },
  RIDER: {
    title: "Comment livrer avec SwiftGoma",
    steps: [
      [
        "Envoyez vos documents",
        "Pièce d'identité et selfie, permis de conduire (moto ou voiture), photo de votre véhicule et de sa plaque.",
      ],
      [
        "Acceptez le contrat livreur",
        "L'acceptation se fait dans l'application, avec un code reçu sur votre téléphone.",
      ],
      [
        "Faites-vous relier à des boutiques",
        "Une fois votre dossier approuvé, choisissez une boutique et envoyez une demande. Le vendeur l'accepte ou la refuse. Vous pouvez travailler avec plusieurs boutiques.",
      ],
      [
        "Confirmez le montant avant de partir",
        "Le montant de chaque livraison est convenu avec la boutique et confirmé avant le départ.",
      ],
      [
        "Livrez et scannez le QR",
        "Votre position est partagée pendant la livraison. Après le scan du QR de l'acheteur, le montant arrive dans votre portefeuille et devient disponible après 24 heures.",
      ],
    ],
    tip: "Conseil : ajoutez un contact de récupération dans la sécurité du compte, pour retrouver votre accès si vous perdez votre téléphone.",
  },
};

function guideFor(role) {
  return GUIDES[role] || GUIDES.BUYER;
}

function renderSteps(steps) {
  return steps
    .map(
      ([title, body], i) => `
<tr>
<td valign="top" style="padding:0 14px 18px 0;width:28px;">
<div style="width:28px;height:28px;line-height:28px;text-align:center;border-radius:14px;background:${BRAND_COLOR};color:#ffffff;font-family:${FONT};font-size:14px;font-weight:600;">${i + 1}</div>
</td>
<td valign="top" style="padding:0 0 18px 0;font-family:${FONT};font-size:16px;line-height:24px;color:#111111;">
<strong>${escapeHtml(title)}</strong><br>
<span style="font-size:14px;line-height:22px;color:#4b5563;">${escapeHtml(body)}</span>
</td>
</tr>`,
    )
    .join("");
}

function welcomeTemplate({ name, role }) {
  const guide = guideFor(role);
  const greeting = name ? `Bienvenue ${escapeHtml(name)},` : "Bienvenue,";

  const html = renderLayout({
    preheader: "Votre compte SwiftGoma est prêt",
    content: `
<p style="${styles.p}">${greeting}</p>
<p style="${styles.p}">Votre compte est prêt. ${escapeHtml(INTRO)}</p>
<p style="margin:0 0 16px 0;font-family:${FONT};font-size:18px;line-height:26px;font-weight:600;color:#111111;">${escapeHtml(guide.title)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px 0;">
${renderSteps(guide.steps)}
</table>
<p style="${styles.muted}">${escapeHtml(guide.tip)}</p>`,
  });

  const text = [
    name ? `Bienvenue ${name},` : "Bienvenue,",
    "",
    `Votre compte est prêt. ${INTRO}`,
    "",
    guide.title,
    "",
    ...guide.steps.flatMap(([title, body], i) => [`${i + 1}. ${title}`, `   ${body}`, ""]),
    guide.tip,
    textFooter(),
  ].join("\n");

  return { subject: "Bienvenue sur SwiftGoma MarketPlace", html, text };
}

module.exports = { welcomeTemplate };
