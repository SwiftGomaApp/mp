# swiftgoma-mp-auth

La bibliothèque de connexion des applications SwiftGoma. Elle gère l'inscription, la connexion, la
vérification en deux étapes et le maintien de la session, pour les applications **React Native
(Expo)**, **Next.js** et **Vite**. Elle parle aux routes `/api/v1/auth` du serveur SwiftGoma, et à
rien d'autre.

> **Pré-version (0.x).** L'API peut encore changer avant la première version stable.

Ce que vous obtenez sans l'écrire vous-même :

- **Des jetons à l'abri.** Sur un téléphone, ils vivent dans le stockage sécurisé de l'appareil.
  Dans un navigateur, aucun jeton n'atteint jamais JavaScript : le serveur garde la session dans des
  cookies HttpOnly.
- **Plus d'erreur de jeton expiré.** Le jeton d'accès est renouvelé 5 minutes avant son expiration,
  une requête à la fois. Les onglets d'un même navigateur passent chacun leur tour.
- **Une seule façon d'échouer.** Chaque erreur est une `ApiError` typée qui porte le code d'erreur
  du serveur.
- **JavaScript ou TypeScript**, en ESM ou en CommonJS.

## Comment lire ce guide

Commencez par le haut et arrêtez-vous dès que vous avez ce qu'il vous faut.

| Vous voulez…                                               | Lisez                                                                            |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Faire fonctionner la connexion dans une appli              | « 1. Installer », puis « 2. Configurer », puis « 3. Connecter les utilisateurs » |
| Comprendre ce que le paquet fait pour vous                 | « Comment ça marche »                                                            |
| Afficher l'utilisateur connecté dans vos écrans            | « 4. Utiliser la session »                                                       |
| Faire une chose précise (réinitialiser un mot de passe, …) | « 5. Recettes »                                                                  |
| Chercher un nom, un code ou un point d'entrée              | « Référence »                                                                    |
| Réparer ce qui ne marche pas                               | « Dépannage »                                                                    |

---

## Comment ça marche

Trois idées expliquent tout le paquet.

**1. L'adaptateur cache la plateforme.** Vous créez le paquet une seule fois avec un _adaptateur_ :
l'adaptateur natif pour Expo, l'adaptateur web pour les navigateurs. Tout le reste de votre code est
identique sur les deux.

**2. La session est maintenue pour vous.** Après une connexion, le paquet renouvelle le jeton
d'accès avant son expiration, de nouveau quand l'appli revient au premier plan, et une dernière fois
si le serveur dit quand même qu'il a expiré. Vous utilisez `auth.api` (un client Axios) sans jamais
penser aux jetons.

**3. Une connexion se termine par l'un de trois résultats.** `authenticated`, `twoFactorRequired`
ou `twoFactorEnrollmentRequired`. Vos écrans gèrent ces trois cas, quelle que soit la méthode
choisie par l'utilisateur.

```
 inscription / connexion ──► résultat ──┬─ authenticated ──► session ouverte, renouvelée en arrière-plan
                                        ├─ twoFactorRequired ──► demander le code ──► authenticated
                                        └─ twoFactorEnrollmentRequired ──► configurer l'appli ──► authenticated
```

---

## 1. Installer

```bash
npm install swiftgoma-mp-auth axios
```

- `axios` (1.7 ou plus) est une **dépendance homologue** (peer) : votre appli et le paquet partagent
  une seule copie.
- `react` est une dépendance homologue **facultative**, nécessaire seulement pour
  `swiftgoma-mp-auth/react`.
- Node 20 ou plus pour les outils. Le paquet lui-même fonctionne dans les navigateurs et dans React
  Native.

## 2. Configurer

Créez l'objet `auth` **une seule fois**, dans son propre fichier, et importez-le là où vous en avez
besoin.

### Expo (iOS et Android)

L'appli fournit au paquet les modules Expo qu'elle utilise déjà : le paquet ne vous demande rien
d'autre à installer.

```ts
// auth.ts
import { createAuth } from "swiftgoma-mp-auth";
import { createNativeAdapter } from "swiftgoma-mp-auth/native";
import * as SecureStore from "expo-secure-store";
import * as Device from "expo-device";
import { AppState, Platform } from "react-native";

export const auth = createAuth({
  baseUrl: "https://api.swiftgoma.com", // l'origine de l'API ; /api/v1 est ajouté pour vous
  adapter: createNativeAdapter({
    os: Platform.OS, // "ios" ou "android"
    secureStore: SecureStore, // obligatoire : l'endroit où sont gardés les jetons
    device: Device, // facultatif : un nom d'appareil lisible ("Pixel 8")
    appState: AppState, // facultatif : renouveler la session au retour dans l'appli
  }),
});
```

### Next.js (App Router) et Vite

```ts
// auth.ts
import { createAuth } from "swiftgoma-mp-auth";
import { createWebAdapter } from "swiftgoma-mp-auth/web";

export const auth = createAuth({
  // L'origine de l'API. Utilisez l'origine de l'appli quand un reverse proxy sert les deux
  // (voir « Même origine »).
  baseUrl: process.env.NEXT_PUBLIC_API_ORIGIN!, // Vite : import.meta.env.VITE_API_ORIGIN
  adapter: createWebAdapter(),
});
```

### Démarrer avec React

Entourez votre appli de `AuthProvider`. Il lit la session enregistrée au démarrage de l'appli et
arrête le renouvellement en arrière-plan à sa fermeture. Dans Next.js, mettez-le dans un fichier qui
commence par `"use client"`.

```tsx
import { AuthProvider } from "swiftgoma-mp-auth/react";
import { auth } from "./auth";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider auth={auth} onStartError={(error) => console.warn(error)}>
      {children}
    </AuthProvider>
  );
}
```

Vous n'utilisez pas React ? Appelez `await auth.start()` une fois au démarrage de l'appli, et
`auth.stop()` à sa fin.

### Même origine (navigateurs)

Placez chaque appli web et l'API derrière un seul reverse proxy, pour que le navigateur ne voie
qu'une origine (par exemple `app.example.com` sert aussi `/api/v1`). Le cookie d'accès est lié à
l'hôte exact qui l'a posé : un hôte d'API séparé ne le recevrait jamais dans une page rendue côté
serveur. Alors `baseUrl` est l'origine de l'appli, et `CORS_ORIGINS` du serveur doit la lister.

---

## 3. Connecter les utilisateurs

Chaque appel de connexion renvoie un **résultat**. Gérez les trois cas et vous gérez toutes les
méthodes.

```ts
const result = await auth.login.emailCode.verify({ email, code });

switch (result.status) {
  case "authenticated":
    result.user; // { id, name, email, phone, role, status }
    result.isNewDevice; // true la première fois que cet appareil se connecte
    break;

  case "twoFactorRequired": // le compte a la vérification en deux étapes
    await auth.twoFactor.verify({ code }); // le code de l'appli, ou { backupCode }
    break;

  case "twoFactorEnrollmentRequired": // comptes du personnel, première connexion
    const { secret, otpauthUri } = await auth.twoFactor.enroll.start(); // afficher un QR code
    const done = await auth.twoFactor.enroll.confirm({ code }); // done.backupCodes : à montrer une fois
    break;
}
```

Le jeton qui relie la première étape à la seconde reste dans le paquet, en mémoire, pendant les cinq
minutes que le serveur l'accepte. S'il expire, `auth.twoFactor.verify` lève une
`NotAuthenticatedError` et l'utilisateur recommence la connexion.

### Inscription

L'inscription se fait en deux appels : demander un code, puis le confirmer. L'utilisateur est
connecté quand elle réussit.

```ts
await auth.signup.email({
  name: "Gael",
  email: "gael@example.com",
  role: "BUYER", // "BUYER" | "SELLER" | "RIDER"
  acceptTerms: true, // l'utilisateur a accepté les conditions et la politique de confidentialité
  confirmAge: true, // l'utilisateur a confirmé l'âge minimum
});

const { user } = await auth.signup.verify({ email: "gael@example.com", code: "123456" });
```

Utilisez `auth.signup.phone({ …, phone })` et `verify({ phone, code })` pour un numéro de
téléphone, et `auth.signup.resend({ email })` pour renvoyer le code.

### Méthodes de connexion

| Méthode                                                                   | Ce qu'elle fait                                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `auth.login.emailCode.request({ email })` puis `.verify({ email, code })` | Un code envoyé par e-mail                                          |
| `auth.login.phoneCode.request({ phone, channel? })` puis `.verify(…)`     | Un code par SMS, ou `channel: "EMAIL"` pour le recevoir par e-mail |
| `auth.login.password({ email, password })`                                | E-mail et mot de passe                                             |
| `auth.login.google()` / `auth.login.apple()`                              | Google ou Apple (fournisseurs que vous donnez, ci-dessous)         |
| `auth.login.passkey()`                                                    | Une clé d'accès : empreinte ou visage, rien à saisir               |

### Google, Apple et clés d'accès

Le paquet n'importe jamais de bibliothèque de fournisseur. Vous construisez les fournisseurs avec
vos propres identifiants client et vous les lui passez.

```ts
createAuth({
  baseUrl,
  adapter,
  socials: {
    google: { getIdToken: async (nonce) => /* un jeton d'identité qui porte ce nonce */ },
    apple: { getIdToken: async (nonce) => /* … */ },
  },
  passkeys: {
    getAssertion: async (options) => /* navigator.credentials.get(…) en JSON */,
    createCredential: async (options) => /* navigator.credentials.create(…) en JSON */,
  },
});

auth.socials.enabled; // { google: true, apple: true } — pour afficher ou masquer les boutons
await auth.login.google();
await auth.signup.apple({ role: "BUYER", acceptTerms: true, confirmAge: true, name });
await auth.login.passkey();
```

Un fournisseur que vous n'avez pas donné lève `SocialLoginDisabledError` ou
`PasskeysDisabledError` avant l'envoi de toute requête. Apple ne donne le nom de l'utilisateur
qu'une seule fois : passez-le à `signup.apple` dans `name`.

---

## 4. Utiliser la session

### Dans React

```tsx
import { useSession, useCurrentUser, useAuth } from "swiftgoma-mp-auth/react";

function Root() {
  const session = useSession(); // { status, user, accessExpiresAt } ; se met à jour à chaque changement
  if (session.status === "unknown") return <Splash />;
  return session.status === "authenticated" ? <Home /> : <SignIn />;
}

const user = useCurrentUser(); // l'utilisateur, ou null
const auth = useAuth(); // l'objet issu de createAuth
```

`status` vaut :

- `"unknown"` : le paquet n'a pas encore vérifié. Sur un téléphone, `AuthProvider` le règle sur
  `"anonymous"` ou retrouve des jetons enregistrés. Dans un **navigateur**, il reste `"unknown"`
  après un rechargement tant que vous n'appelez pas `auth.me()`, car JavaScript ne voit pas le
  cookie.
- `"authenticated"` : un utilisateur est connecté.
- `"anonymous"` : personne n'est connecté.

### Retrouver la session au chargement de la page (navigateurs)

```tsx
"use client";
import { useEffect } from "react";
import { useAuth } from "swiftgoma-mp-auth/react";

export function RestoreSession() {
  const auth = useAuth();
  useEffect(() => {
    auth.me().catch(() => undefined); // un visiteur non connecté reçoit un 401 : c'est normal
  }, [auth]);
  return null;
}
```

`auth.me()` renouvelle seul un cookie d'accès expiré : un utilisateur qui revient le lendemain est
toujours connecté.

### Appeler votre API

```ts
const orders = await auth.api.get("/orders"); // les jetons sont envoyés et renouvelés pour vous
```

`auth.api` est une instance Axios ordinaire dont l'adresse de base est l'origine de l'API suivie de
`/api/v1`.

### Sans React

```ts
auth.session.getState(); // { status, user, accessExpiresAt }
auth.session.subscribe((state) => {}); // renvoie une fonction pour se désabonner
auth.session.onSessionEnded((reason) => {}); // la session a été refusée, ex. "REFRESH_TOKEN_INVALID"
auth.session.onTokenRefreshed((token) => {}); // un nouveau jeton d'accès, ou null à la fin de la session
await auth.session.getAccessToken(); // pour une bibliothèque qui a besoin du jeton ; null dans un navigateur
await auth.session.refreshNow();
```

### Pages rendues côté serveur (Next.js)

Un serveur ne peut pas poser de cookies pour le navigateur : il ne peut que lire. Transmettez les
cookies du visiteur :

```ts
import { headers } from "next/headers";
import { createServerClient, fetchCurrentUser } from "swiftgoma-mp-auth/web/server";

export async function getUser() {
  const client = createServerClient({
    baseUrl: process.env.API_ORIGIN!,
    cookie: (await headers()).get("cookie"),
  });
  return fetchCurrentUser(client); // l'utilisateur, ou null si le visiteur n'est pas connecté
}
```

---

## 5. Recettes

### Se déconnecter

```ts
await auth.logout(); // cet appareil
await auth.logoutAll(); // tous les appareils ; renvoie { revoked: number }
```

La session locale se termine même si le serveur est injoignable ; dans ce cas l'erreur est levée
après l'effacement de la session.

### Réinitialiser un mot de passe oublié

```ts
await auth.password.forgot({ email }); // envoie un code ; la réponse est la même pour n'importe quel e-mail
await auth.password.reset({ email, code, newPassword }); // puis l'utilisateur se reconnecte
```

### Changer un réglage sensible : les codes de confirmation (step-up)

Changer un mot de passe, lier un fournisseur, ajouter un contact de récupération ou une clé d'accès
demande un code récent. Demandez-le, puis passez-le à l'action :

```ts
await auth.stepUp.request(); // envoie un code à un contact vérifié ; { channel: "PHONE" } pour choisir
await auth.password.change({ currentPassword, newPassword, code });
await auth.password.create({ password, code }); // ajouter un mot de passe à un compte qui n'en a pas
await auth.password.remove({ code });
```

Si le compte a la vérification en deux étapes, le code est celui de l'application
d'authentification (voir `CurrentUser.twoFactorEnabled`). Le paquet ne garde jamais un code de
confirmation.

### Afficher et déconnecter les appareils

```ts
const devices = await auth.devices.list(); // [{ id, deviceName, platform, city, lastSeenAt, current }]
await auth.devices.disconnect(devices[1].id); // déconnecte cet appareil
```

Un utilisateur peut avoir jusqu'à 5 appareils ; la sixième connexion déconnecte le plus ancien.

### Gérer le compte

```ts
import { createAccount } from "swiftgoma-mp-auth/account";

const account = createAccount(auth, { socials, passkeys }); // fournisseurs seulement si vous les utilisez
await account.twoFactor.status(); // { enabled, mandatory, backupCodesRemaining }
await account.twoFactor.setup(); // puis account.twoFactor.confirm({ code, stepUpCode })
await account.passkeys.register({ stepUpCode });
await account.link.google({ stepUpCode });
await account.methods.list();
await account.recoveryContacts.requestCode({ kind: "EMAIL", value, stepUpCode });
await account.activity({ category: "SECURITY" });
await account.security(); // la liste de contrôle de sécurité
await account.recovery.request({ email }); // 5 étapes pour retrouver l'accès à un compte
await account.supportRequest({ email, message }); // pour un compte suspendu
```

### Le tableau de bord d'administration

```ts
import { createStaff } from "swiftgoma-mp-auth/staff";

const staff = createStaff(auth);
await staff.create({ name, email, code }); // un compte Support ; le membre reçoit un lien d'activation
await staff.setup({ token, newPassword }); // depuis le lien, sans session
await staff.supportRequests.list({ status: "OPEN" });
```

Le serveur vérifie le rôle à chaque appel. Un appel sans le bon rôle lève une `ForbiddenError`.

### Gérer les erreurs

```ts
import { hasErrorCode, isApiError, ValidationError, TooManyRequestsError } from "swiftgoma-mp-auth";

try {
  await auth.login.emailCode.verify({ email, code });
} catch (error) {
  if (hasErrorCode(error, "OTP_INVALID")) showWrongCode();
  else if (error instanceof ValidationError) form.setErrors(error.messagesByField);
  else if (error instanceof TooManyRequestsError) wait(error.retryAfterSeconds);
  else if (isApiError(error)) show(error.message, error.requestId); // en français, venant du serveur
}
```

### Journaliser ce que fait le paquet

```ts
createAuth({ baseUrl, adapter, logger: (event) => console.debug(event.name, event.detail) });
```

Événements : `refresh.start`, `refresh.ok`, `refresh.failed`, `refresh.busy`, `refresh.adopted`,
`session.ended`, `token.scheduled`, `token.retry`, `request.retried`. Le détail contient des noms,
des codes d'erreur, des statuts et des délais — jamais un jeton, un code, un mot de passe ou un
corps de requête.

### Tester votre appli

```ts
import { createAuth } from "swiftgoma-mp-auth";
import { createFakeAuthServer, createTestAdapter } from "swiftgoma-mp-auth/testing";

const server = createFakeAuthServer();
server.addUser({ email: "gael@example.com", password: "secret123" });

const auth = createAuth({
  baseUrl: "https://api.test",
  adapter: createTestAdapter("ANDROID"), // ou "WEB" ; passez un stockage pour simuler un redémarrage
  transport: server.transport,
});

await auth.login.password({ email: "gael@example.com", password: "secret123" });
server.expireAccessTokens(); // l'appel suivant renouvelle la session tout seul
server.revokeSessions(); // déconnecte tout le monde
server.setOffline(true); // les requêtes échouent comme une connexion perdue
```

`server.code` est le code de confirmation que chaque invite accepte. Le faux serveur répond comme le
vrai pour l'inscription, la connexion (code, code téléphone, mot de passe, seconde étape), le
renouvellement avec rotation et détection de réutilisation, `me`, la déconnexion et les appareils.

---

## Référence

### Points d'entrée

| Import                         | Ce que c'est                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| `swiftgoma-mp-auth`            | `createAuth`, erreurs, codes d'erreur, types                                             |
| `swiftgoma-mp-auth/native`     | `createNativeAdapter` pour Expo (iOS, Android)                                           |
| `swiftgoma-mp-auth/web`        | `createWebAdapter` pour les navigateurs                                                  |
| `swiftgoma-mp-auth/web/server` | `createServerClient`, `fetchCurrentUser` pour le rendu serveur de Next.js                |
| `swiftgoma-mp-auth/react`      | `AuthProvider`, `useAuth`, `useSession`, `useCurrentUser`                                |
| `swiftgoma-mp-auth/account`    | `createAccount` : deux étapes, clés d'accès, liaison, méthodes, récupération, historique |
| `swiftgoma-mp-auth/staff`      | `createStaff` : comptes du personnel et demandes au Support                              |
| `swiftgoma-mp-auth/testing`    | `createFakeAuthServer`, `createTestAdapter`                                              |

### Options de `createAuth`

| Option                  | Signification                                                             |
| ----------------------- | ------------------------------------------------------------------------- |
| `baseUrl` (obligatoire) | L'origine de l'API. `/api/v1` est ajouté ; une barre finale est acceptée. |
| `adapter` (obligatoire) | Issu de `createNativeAdapter` ou `createWebAdapter`.                      |
| `socials`               | Fournisseurs `{ google?, apple? }`. Désactivés s'ils manquent.            |
| `passkeys`              | `{ getAssertion, createCredential }`. Désactivées si absentes.            |
| `requestTimeoutMs`      | Durée d'attente d'une réponse. 15000 par défaut.                          |
| `refreshMarginSeconds`  | Renouveler cette durée avant l'expiration. 300 par défaut (5 minutes).    |
| `logger`                | Appelé avec ce que fait le paquet (voir plus haut).                       |
| `transport`             | Remplace la manière d'envoyer les requêtes. Pour les tests.               |

### Toutes les méthodes

| Domaine       | Méthodes                                                                              |
| ------------- | ------------------------------------------------------------------------------------- |
| Démarrage     | `start()`, `stop()`, `device.get()`                                                   |
| Inscription   | `signup.email`, `.phone`, `.verify`, `.resend`, `.google`, `.apple`                   |
| Connexion     | `login.emailCode`, `.phoneCode`, `.password`, `.google`, `.apple`, `.passkey`         |
| Seconde étape | `twoFactor.verify`, `twoFactor.enroll.start`, `twoFactor.enroll.confirm`              |
| Codes         | `stepUp.request`                                                                      |
| Mot de passe  | `password.create`, `.change`, `.remove`, `.forgot`, `.reset`                          |
| Session       | `me`, `logout`, `logoutAll`, `devices.list`, `devices.disconnect`, `session.*`, `api` |

### Classes d'erreur

| Classe                                                                                     | Quand                                              |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `ValidationError`                                                                          | 422 : `fields`, `messagesByField`                  |
| `TooManyRequestsError`                                                                     | 429 : `retryAfterSeconds`                          |
| `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `BadRequestError` | Le statut HTTP correspondant                       |
| `ServerError`                                                                              | 5xx                                                |
| `NetworkError`, `TimeoutError`                                                             | Aucune réponse du serveur                          |
| `NotAuthenticatedError`                                                                    | Un appel exige une connexion que le paquet n'a pas |
| `SocialLoginDisabledError`, `PasskeysDisabledError`                                        | Vous n'avez pas fourni le fournisseur              |

Chacune est une `ApiError` avec `code`, `status`, `message`, `details`, `requestId` et `cause`.
`ERROR_CODES` liste tous les codes que le serveur peut renvoyer, et `isKnownErrorCode(code)` en
vérifie un. Les messages viennent du serveur, en français.

### Comment une session se comporte

- Le renouvellement commence 5 minutes avant l'expiration du jeton d'accès, avec une avance
  aléatoire pouvant aller jusqu'à 30 secondes pour que les appareils ne renouvellent pas tous en
  même temps. Il a aussi lieu quand l'appli revient au premier plan.
- Un seul renouvellement à la fois. Le serveur change le jeton de renouvellement à chaque usage et
  considère qu'un ancien jeton rejoué est un vol : deux renouvellements simultanés mettraient fin à
  la session. Les onglets du navigateur passent chacun leur tour.
- Si le serveur dit quand même que le jeton a expiré, le paquet renouvelle et renvoie la requête une
  fois.
- Une absence de réseau, un délai dépassé, une erreur serveur ou une limite de débit **gardent la
  session** et réessaient après 5, 15, 30 secondes, puis toutes les 60 secondes. Seul un refus du
  serveur met fin à la session : jeton de renouvellement invalide, absent, réutilisé ou révoqué,
  session expirée, ou compte suspendu.
- La durée d'un jeton est lue d'abord chez le serveur (`expiresIn`), sinon dans la revendication
  `exp` du jeton, sinon supposée de 15 minutes.

---

## Dépannage

**`baseUrl is required`.** Passez l'origine de l'API, par exemple `https://api.swiftgoma.com`. Une
chaîne vide n'est pas acceptée.

**Un navigateur est déconnecté à chaque rechargement.** Le statut de la session reste `"unknown"`
tant que vous n'appelez pas `auth.me()` une fois (voir « Retrouver la session au chargement de la
page »). Si `me()` renvoie 401 et que le renouvellement échoue, vérifiez que l'origine de l'appli
web figure dans `CORS_ORIGINS` du serveur : le renouvellement par cookie est refusé depuis un
`Origin` non listé.

**Les cookies ne sont pas envoyés ou pas gardés.** Le cookie d'accès exige HTTPS et il est lié à
l'hôte exact : il faut donc HTTPS et une seule origine pour l'appli et l'API (voir « Même origine »).
En développement en HTTP simple, il peut falloir un HTTPS local, et Safari est plus strict que
Chrome.

**Un téléphone est déconnecté au redémarrage de l'appli.** Le paquet lève une erreur si le stockage
sécurisé ne peut pas être lu (par exemple, verrouillé). Passez `onStartError` à `AuthProvider`, ou
interceptez `auth.start()`, et réessayez.

**`useAuth must be used inside <AuthProvider>`.** Entourez l'arbre de composants, et dans Next.js
faites du fichier un composant client.

**`SocialLoginDisabledError` ou `PasskeysDisabledError`.** Donnez le fournisseur à `createAuth` (et
à `createAccount` pour lier et enregistrer).

**Chaque utilisateur semble être sur un nouvel appareil.** L'identifiant d'appareil est gardé dans
le stockage ; si le stockage est bloqué (navigateur en navigation privée), il ne dure que le temps
de la session. Chaque lancement compte alors dans la limite de 5 appareils.

**Trop de requêtes.** Les limites de débit répondent 429 avec `retryAfterSeconds`. Attendez cette
durée avant de demander un autre code.

## Compatibilité

Le paquet suit le `/api/v1` du serveur SwiftGoma. Utilisez une version du paquet de la même période
que votre serveur. Tant que la version est en `0.x`, lisez les notes de version avant de mettre à
jour.
