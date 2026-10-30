# swiftgoma-mp-notifications

La bibliothèque de notifications des applications SwiftGoma : la boîte de réception, les
préférences, les notifications push et les mises à jour en direct, pour les applications **React
Native (Expo)**, **Next.js** et **Vite**. Elle parle aux routes `/api/v1/notifications` du serveur
SwiftGoma et à la connexion Socket.IO du même serveur, et à rien d'autre.

> **Pré-version (0.x).** L'API peut encore changer avant la première version stable.

Elle s'appuie sur [`swiftgoma-mp-auth`](../auth) : la session, les jetons et le client HTTP viennent
de là. Configurez d'abord l'authentification, puis ce paquet.

## Ce que vous obtenez

- **Une boîte de réception prête à afficher.** Pages, filtre par contexte, compteurs, lecture,
  accusé de réception, suppression. Chaque action s'affiche tout de suite et revient en arrière si
  le serveur la refuse.
- **Des mises à jour en direct.** Une notification arrive, un compteur change : l'écran suit, sur
  tous les appareils de la personne.
- **Un push qu'on peut couper.** Le paquet n'importe jamais de module natif. Sans fournisseur, le
  push est éteint et l'application tourne dans Expo Go.
- **Des préférences.** Canaux par catégorie, heures de silence, consentement marketing.
- **Des erreurs typées.** Ce sont les `ApiError` de `swiftgoma-mp-auth`, avec le code d'erreur du
  serveur.

## Comment lire ce guide

| Je veux…                             | Je lis                                                         |
| ------------------------------------ | -------------------------------------------------------------- |
| Brancher le paquet dans mon appli    | [1. Installer](#1-installer) et [2. Configurer](#2-configurer) |
| Afficher la boîte et le badge        | [3. Les écrans](#3-les-écrans)                                 |
| Activer ou couper le push            | [4. Le push](#4-le-push)                                       |
| Garder l'écran à jour sans recharger | [5. Le temps réel](#5-le-temps-réel)                           |
| Tester mon appli                     | [6. Les tests de votre appli](#6-les-tests-de-votre-appli)     |
| Une recette précise                  | [7. Recettes](#7-recettes)                                     |
| Un problème                          | [Dépannage](#dépannage)                                        |

## Comment ça marche

```
 Votre appli
   │  hooks React (/react)  ou  notifications.store
   ▼
 createNotifications ── REST ──► /api/v1/notifications   (boîte, préférences, appareils)
   │        │
   │        └─ push ──► fournisseur injecté (OneSignal dans /native), ou rien
   ▼
 createRealtime ── Socket.IO ──► notification:new / read / deleted
```

- **Le serveur décide.** Le paquet ne choisit jamais quel canal, quel événement ou quelle
  préférence existe. Un test compare ses constantes au code du serveur.
- **Un seul état.** `notifications.store` est la boîte vue par tous les écrans : le badge et la
  liste ne peuvent pas se contredire.
- **Les appels REST sont authentifiés par `swiftgoma-mp-auth`.** Pas de jeton à gérer ici.

---

## 1. Installer

```bash
npm install swiftgoma-mp-notifications swiftgoma-mp-auth axios
```

| Dépendance          | Quand                                               |
| ------------------- | --------------------------------------------------- |
| `swiftgoma-mp-auth` | toujours                                            |
| `axios`             | toujours                                            |
| `react`             | seulement pour l'entrée `/react`                    |
| `socket.io-client`  | seulement pour l'entrée `/realtime` (le temps réel) |

Pour le temps réel :

```bash
npm install socket.io-client
```

Pour le push dans une application Expo (hors Expo Go) :

```bash
npx expo install react-native-onesignal onesignal-expo-plugin
```

## 2. Configurer

Créez les objets **une seule fois**, dans un fichier à part, hors de tout composant.

### Expo (iOS et Android)

```ts
// notifications.ts
import Constants from "expo-constants";
import { createNotifications } from "swiftgoma-mp-notifications";
import { createOneSignalProvider, isPushSupported } from "swiftgoma-mp-notifications/native";
import { createRealtime } from "swiftgoma-mp-notifications/realtime";
import { auth } from "./auth";

export const notifications = createNotifications({
  auth,
  push: isPushSupported(Constants)
    ? createOneSignalProvider({
        appId: process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID!,
        load: () => require("react-native-onesignal"),
      })
    : undefined,
});

export const realtime = createRealtime({ auth, store: notifications.store });
```

`isPushSupported(Constants)` est faux dans **Expo Go** : le fournisseur n'est alors pas créé, le
module natif n'est jamais chargé, et l'application ne plante pas. La boîte, les préférences et le
temps réel marchent quand même.

### Next.js (App Router) et Vite

Le push web n'est pas géré par ce paquet : laissez `push` de côté.

```ts
// notifications.ts
import { createNotifications } from "swiftgoma-mp-notifications";
import { createRealtime } from "swiftgoma-mp-notifications/realtime";
import { auth } from "./auth";

export const notifications = createNotifications({ auth });
export const realtime = createRealtime({ auth, store: notifications.store });
```

Dans Next.js, le fournisseur React doit être dans un composant client (`"use client"`). Le
navigateur doit venir d'une origine autorisée par le serveur : le temps réel y utilise le cookie de
session.

### Démarrer avec React

```tsx
// App.tsx
import { AuthProvider } from "swiftgoma-mp-auth/react";
import { NotificationsProvider } from "swiftgoma-mp-notifications/react";

<AuthProvider auth={auth}>
  <NotificationsProvider notifications={notifications} realtime={realtime}>
    <Screens />
  </NotificationsProvider>
</AuthProvider>;
```

Le fournisseur démarre tout au montage et arrête tout au démontage. Il doit être **à l'intérieur**
de `AuthProvider`, qui démarre la session.

### Sans React

```ts
await auth.start();
notifications.start();
realtime.start();
```

Appelez `stop()` sur chacun pour tout arrêter.

### Options de `createNotifications`

| Option        | Rôle                                                                               |
| ------------- | ---------------------------------------------------------------------------------- |
| `auth`        | l'objet de `swiftgoma-mp-auth` (obligatoire)                                       |
| `push`        | le fournisseur push. Sans lui, le push est éteint                                  |
| `pushEnabled` | `false` coupe le push même avec un fournisseur (par exemple selon l'environnement) |
| `pageSize`    | nombre de notifications par page                                                   |
| `onError`     | appelée pour les erreurs que le paquet absorbe (une actualisation en arrière-plan) |

`createRealtime` accepte aussi `url` si le serveur temps réel n'est pas à l'adresse de l'API.

## 3. Les écrans

```tsx
import { useInbox, useUnreadCount } from "swiftgoma-mp-notifications/react";

function Badge() {
  return <Text>{useUnreadCount()}</Text>;
}

function Inbox() {
  const { items, status, nextCursor, loadMore, markRead, remove, setContext } = useInbox();
  // status : "idle" | "loading" | "ready" | "error"
}
```

| Hook                   | Donne                                                                         |
| ---------------------- | ----------------------------------------------------------------------------- |
| `useInbox()`           | `items`, `status`, `unreadCount`, `byContext`, `context`, et les actions      |
| `useUnreadCount()`     | le nombre de non lues, même si la boîte n'est pas chargée                     |
| `useUnreadByContext()` | le nombre de non lues par contexte                                            |
| `usePreferences()`     | les catégories, les réglages, `update()` et `updateSettings()`                |
| `usePush()`            | l'état du push et `enable()`, `disable()`, `requestPermission()`, `refresh()` |
| `usePushOpen(fn)`      | appelle `fn` quand la personne ouvre l'appli depuis un push (pour naviguer)   |
| `useRealtimeState()`   | l'état de la connexion en direct                                              |
| `useNotifications()`   | l'objet `notifications` tel quel                                              |

`useInbox()` charge la première page au montage. `useInbox({ autoLoad: false })` laisse ce choix à
l'écran. Les actions (`markRead`, `acknowledge`, `markAllRead`, `remove`) refusent avec l'erreur du
serveur ; `load`, `loadMore` et `refresh` ne refusent jamais, l'erreur est dans `error`.

### Une notification

| Champ            | Sens                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------- |
| `id`             | identifiant                                                                                 |
| `type`           | l'événement, par exemple `order.placed`                                                     |
| `context`        | `SECURITY`, `PURCHASE`, `SALE`, `DELIVERY`, `SUPPORT`, `ADMIN`, `ANNOUNCEMENT`, `MARKETING` |
| `priority`       | `LOW`, `NORMAL`, `HIGH`, `CRITICAL`                                                         |
| `title`, `body`  | le texte, en français, écrit par le serveur                                                 |
| `data`           | les données de l'événement (identifiant de commande…), ou `null`                            |
| `readAt`         | date de lecture, ou `null`                                                                  |
| `acknowledgedAt` | date d'accusé de réception, ou `null`                                                       |
| `createdAt`      | date de création                                                                            |

Les textes viennent du serveur : le paquet ne traduit rien.

### Filtrer par contexte

```tsx
const { items, byContext, context, setContext } = useInbox();

<Tab label={`Ventes (${byContext.SALE ?? 0})`} onPress={() => setContext("SALE")} />;
<Tab label="Tout" onPress={() => setContext(null)} />;
```

### Pagination

```tsx
<FlatList data={items} onEndReached={() => nextCursor && loadMore()} />
```

### Les préférences

```tsx
function Settings() {
  const { status, preferences, update, updateSettings } = usePreferences();
  if (status !== "ready" || !preferences) return null;

  return preferences.categories.map((category) => (
    <Row key={category.context} label={category.label} locked={category.locked}>
      {category.channels.map((channel) => (
        <Switch
          key={channel.channel}
          value={channel.enabled}
          disabled={channel.locked}
          onValueChange={(enabled) =>
            update([{ context: category.context, channel: channel.channel, enabled }])
          }
        />
      ))}
    </Row>
  ));
}
```

- Les canaux modifiables sont `PUSH`, `SMS` et `EMAIL`.
- Un canal ou une catégorie `locked` ne peut pas être changé : le serveur refuse avec
  `PREFERENCE_LOCKED`. Les événements obligatoires (sécurité, alertes) ignorent les préférences.
- `updateSettings` change le fuseau horaire, les heures de silence et le consentement marketing :

```ts
await updateSettings({ marketingEmailOptIn: true });
await updateSettings({ quietHoursEnabled: true, quietHoursStart: 22 * 60, quietHoursEnd: 7 * 60 });
```

Les heures de silence se donnent en **minutes depuis minuit** (ici de 22 h à 7 h), dans le fuseau
`timezone` de la personne. Une plage invalide (début égal à la fin, ou absent) est refusée avec
`INVALID_QUIET_HOURS`.

## 4. Le push

| `status`            | Sens                                                                      |
| ------------------- | ------------------------------------------------------------------------- |
| `disabled`          | pas de fournisseur, ou push coupé : rien de natif n'est touché            |
| `idle`              | prêt, mais personne n'est connecté                                        |
| `unavailable`       | le fournisseur n'a pas démarré (Expo Go, module natif absent)             |
| `permission-needed` | la personne n'a pas encore été interrogée : appelez `requestPermission()` |
| `denied`            | la personne a refusé : seuls les réglages du système peuvent changer ça   |
| `enabled`           | autorisé et abonné. `registered` dit si le serveur le sait                |

```tsx
function PushSwitch() {
  const { status, requestPermission, disable, enable } = usePush();

  if (status === "disabled" || status === "unavailable") return null;
  if (status === "denied") return <Text>Activez les notifications dans les réglages.</Text>;
  if (status === "permission-needed") return <Button title="Activer" onPress={requestPermission} />;
  return <Button title="Couper" onPress={disable} />;
}
```

- Le paquet enregistre l'appareil à la connexion. Appelez `push.refresh()` quand l'appli revient au
  premier plan : un enregistrement échoué est retenté à ce moment.
- `disable()` retire l'appareil du serveur ; `enable()` le remet.
- Avant `auth.logout()`, appelez `await notifications.push.unregister()` pour retirer l'appareil
  pendant que la session fonctionne. L'oublier est sans danger : le serveur ignore les appareils
  dont la session est finie.
- Un appui sur un push est signalé au serveur (`POST /notifications/:id/opened`) puis transmis à
  `usePushOpen`.

### Ouvrir le bon écran depuis un push

```tsx
import { useRouter } from "expo-router";

function PushNavigation() {
  const router = useRouter();
  usePushOpen(({ notificationId, type }) => {
    if (type?.startsWith("order.")) router.push("/orders");
    else router.push("/notifications");
  });
  return null;
}
```

Montez ce composant une fois, sous le fournisseur.

### Expo Go

Dans **Expo Go**, `isPushSupported(Constants)` est faux : passez `undefined` comme fournisseur. La
boîte, les préférences et le temps réel marchent ; seul le push est éteint. Testez le vrai push dans
une _development build_ (`npx expo run:ios` / `run:android`, ou EAS Build).

## 5. Le temps réel

`createRealtime` se connecte dès qu'une personne est connectée et suit la session.

```tsx
function LiveDot() {
  const { status } = useRealtimeState();
  return <Dot color={status === "connected" ? "green" : "gray"} />;
}
```

`status` : `idle`, `connecting`, `connected`, `disconnected`, `stopped`.

- Mobile : le jeton d'accès part dans la poignée de main. Web : le cookie, depuis une origine
  autorisée.
- Une minute avant l'expiration, le serveur envoie `auth:expiring` : le paquet renouvelle la
  session, puis envoie le nouveau jeton (mobile) ou se reconnecte (web).
- Après une coupure : nouvelle tentative avec un délai croissant (1 s, 2 s, … jusqu'à 30 s). À
  chaque connexion, la boîte est rechargée si elle l'était déjà, pour rattraper les événements
  manqués.
- Ces raisons arrêtent les tentatives (`status: "stopped"`, avec `error`) : `SESSION_REVOKED`,
  `ACCOUNT_BLOCKED`, `TWO_FACTOR_REQUIRED`, `ORIGIN_NOT_ALLOWED`. `realtime.reconnect()` réessaie.
- Si le serveur ferme la connexion sans raison d'expiration (par exemple au-delà de 5 connexions par
  personne), le paquet ne se reconnecte pas tout seul. Appelez `realtime.reconnect()` au retour au
  premier plan.

### Au retour au premier plan (mobile)

```tsx
import { AppState } from "react-native";

useEffect(() => {
  const subscription = AppState.addEventListener("change", (state) => {
    if (state !== "active") return;
    void notifications.push.refresh();
    if (realtime.getState().status !== "connected") realtime.reconnect();
  });
  return () => subscription.remove();
}, []);
```

## 6. Les tests de votre appli

`swiftgoma-mp-notifications/testing` fournit un serveur factice et un fournisseur push factice.

```ts
import { createHttpClient } from "swiftgoma-mp-auth";
import {
  createFakeNotificationsServer,
  createFakePushProvider,
} from "swiftgoma-mp-notifications/testing";

const server = createFakeNotificationsServer({ role: "SELLER" });
server.add({ type: "sale.order.new", title: "Nouvelle commande" });

const api = createHttpClient({ baseUrl: "https://api.test", adapter: server.transport });
```

Pour partager un client avec le serveur factice de `swiftgoma-mp-auth`, servez-vous de
`combineTransports({ "/auth": authServer.transport, "/notifications": server.transport })`.

`createFakePushProvider()` permet de simuler une permission, un changement d'abonnement
(`changeSubscription`) et un appui sur un push (`tap`) :

```ts
const provider = createFakePushProvider({ permission: "undetermined" });
const notifications = createNotifications({ auth, push: provider });

provider.tap({ notificationId: "n1", type: "order.placed" });
```

Le serveur factice garde les notifications (`server.add`), les appareils enregistrés
(`server.devices`), les requêtes reçues (`server.requests`) et sait simuler une panne
(`server.setOffline(true)`).

## 7. Recettes

### Se déconnecter

```ts
await notifications.push.unregister();
await auth.logout();
```

La boîte se vide toute seule à la déconnexion, et quand une autre personne se connecte.

### Tout marquer comme lu

```ts
await markAllRead();
await markAllRead({ context: "SALE" });
```

### Accuser réception d'une notification importante

Pour certains événements, le serveur relance la personne (SMS, par exemple) si elle n'a ni lu ni
accusé réception après un délai. L'accusé de réception arrête cette relance.

```ts
await acknowledge(item.id);
```

### Afficher le badge sur l'icône de l'appli

```tsx
const unread = useUnreadCount();
useEffect(() => {
  void Notifications.setBadgeCountAsync(unread);
}, [unread]);
```

### Appeler la boîte sans React

```ts
const unsubscribe = notifications.store.subscribe(() => {
  const { items, unreadCount } = notifications.store.getState();
});
await notifications.store.load();
await notifications.store.markRead("n1");
```

`notifications.inbox` donne les appels REST bruts (`list`, `unreadCount`, `markRead`,
`acknowledge`, `markAllRead`, `remove`, `markOpened`), sans état partagé.

### Connaître les types de notification

```ts
import { EVENT_CATALOG, EVENT_TYPES } from "swiftgoma-mp-notifications";

EVENT_CATALOG["order.placed"]; // { context, priority, mandatory, channels, escalation, … }
```

`notifications.catalog.list()` demande la liste au serveur, filtrée selon le rôle de la personne.

### Gérer les erreurs

Les erreurs sont celles de `swiftgoma-mp-auth`.

```ts
import { ApiError } from "swiftgoma-mp-auth";

try {
  await update([{ context: "SECURITY", channel: "SMS", enabled: false }]);
} catch (error) {
  if (error instanceof ApiError && error.code === "PREFERENCE_LOCKED") {
    showToast("Ce réglage ne peut pas être changé.");
  } else {
    throw error;
  }
}
```

Codes courants : `NOTIFICATION_NOT_FOUND`, `PREFERENCE_LOCKED`, `INVALID_QUIET_HOURS`.

## Référence

### Points d'entrée

| Import                                | Contenu                                                               |
| ------------------------------------- | --------------------------------------------------------------------- |
| `swiftgoma-mp-notifications`          | `createNotifications`, la boîte (`inbox`, `store`), types, constantes |
| `swiftgoma-mp-notifications/react`    | `NotificationsProvider` et les hooks                                  |
| `swiftgoma-mp-notifications/realtime` | `createRealtime`                                                      |
| `swiftgoma-mp-notifications/native`   | `createOneSignalProvider`, `isPushSupported`, `isExpoGo`              |
| `swiftgoma-mp-notifications/testing`  | serveur factice, fournisseur push factice, `combineTransports`        |

### L'objet `notifications`

| Membre                      | Rôle                                                         |
| --------------------------- | ------------------------------------------------------------ |
| `notifications.store`       | l'état en direct que lisent les écrans                       |
| `notifications.inbox`       | les appels REST de la boîte, un par un                       |
| `notifications.preferences` | `get`, `update`, `updateSettings`                            |
| `notifications.catalog`     | `list`                                                       |
| `notifications.devices`     | `register`, `remove`                                         |
| `notifications.push`        | le contrôleur push                                           |
| `start()` / `stop()`        | démarrer et arrêter le paquet (le fournisseur React le fait) |

`EVENT_TYPES` et `EVENT_CATALOG` listent les 30 types de notification du serveur ; un test compare
cette liste au code du serveur.

## Dépannage

| Symptôme                                                | Cause probable                                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| L'appli plante dans Expo Go                             | Un fournisseur push est passé. Utilisez `isPushSupported(Constants)`           |
| `usePush().status` reste `unavailable`                  | Module natif absent : faites une _development build_                           |
| `status` reste `permission-needed`                      | Appelez `requestPermission()` depuis un geste de la personne                   |
| `status` est `denied`                                   | Refus dans le système : la personne doit changer le réglage elle-même          |
| Le badge reste à 0                                      | Personne n'est connecté, ou `NotificationsProvider` est hors de `AuthProvider` |
| Pas de mise à jour en direct                            | `realtime` n'est pas passé au fournisseur, ou `status` vaut `stopped`          |
| `realtime` est `stopped` avec `ORIGIN_NOT_ALLOWED`      | Le site web n'est pas dans les origines autorisées du serveur                  |
| Le temps réel se coupe après un retour d'arrière-plan   | Appelez `realtime.reconnect()` au retour au premier plan                       |
| `The hooks must be used inside <NotificationsProvider>` | Le composant est hors du fournisseur                                           |
| Les textes sont en français quoi que je fasse           | C'est voulu : le serveur écrit les textes, le paquet ne traduit pas            |

## Compatibilité

- Node 20 et plus, navigateurs récents, React Native avec Expo (SDK récent).
- ESM et CommonJS, avec les types TypeScript.
- Le push passe par OneSignal (`react-native-onesignal`). Un autre fournisseur est possible : il
  suffit d'implémenter `PushProvider` (`init`, `getPermission`, `requestPermission`,
  `getSubscriptionId`, `onSubscriptionChange`, `onOpen`, `identify`, `forget`).

## Développement

```bash
npm run verify
```

Vérifie le format, les types, les tests et la publication du paquet. Le test `server-drift` lit le
code du serveur voisin (`server/`) ; indiquez un autre emplacement avec la variable `SERVER_ROOT`.
