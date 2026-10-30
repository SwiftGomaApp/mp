# swiftgoma-mp-notifications: package scope (v1)

Shared notifications client for every SwiftGoma app. This file is the source of truth for what the
package is, what it leaves out and the decisions already taken. The server contract is described in
`docs/notification-system-scope.md`; the server code is the final authority.

Location: `packages/notifications`. npm name: `swiftgoma-mp-notifications`.

---

## 1. Purpose

Every app shows the same inbox, badge, preferences and live updates. Cursor paging, optimistic
counts, session-bound push registration and socket reconnection are written, tested and fixed once.

- **The package owns:** the REST calls, the live inbox state, the push registration flow, the live
  connection and the test helpers.
- **Apps own:** screens, navigation, translations (the server texts are French), and the choice and
  configuration of the push SDK.

Principles:
- The server is the only source of truth. The package never decides which channel, event or
  preference exists; a drift test fails when its constants differ from the server code.
- Nothing native is imported by the package, so an app can run in Expo Go with push off.
- A failed action never leaves the screen wrong: it is rolled back and checked with the server.

## 2. Decisions taken

| Topic | Decision |
|---|---|
| npm name | `swiftgoma-mp-notifications` |
| Location | `packages/notifications`, independent npm package (like `packages/auth`) |
| Session and HTTP | Uses `swiftgoma-mp-auth`: its Axios client, session and device identity. Peer dependency |
| Push | An injected provider. OneSignal adapter in `/native`. No provider means push is off |
| Expo Go | `isPushSupported(Constants)` is false; the app passes no provider; nothing native loads |
| Realtime | Own entry `/realtime`, `socket.io-client` as an optional peer dependency |
| Server events in the app | `notification:new`, `notification:read`, `notification:deleted` only |
| Event list | `EVENT_CATALOG` ships in the package and is checked against the server |
| Languages | None: texts come from the server in French |
| Web push | Not in v1 |
| Admin and marketing | Not in v1; a later `/admin` entry |

## 3. Entry points

| Import | Contents | Peer dependencies |
|---|---|---|
| `swiftgoma-mp-notifications` | `createNotifications`, REST calls, inbox store, push controller, types, constants | `axios`, `swiftgoma-mp-auth` |
| `/react` | `NotificationsProvider` and the hooks | `react` |
| `/realtime` | `createRealtime` | `socket.io-client` |
| `/native` | `createOneSignalProvider`, `isPushSupported`, `isExpoGo` | none |
| `/testing` | fake server, fake push provider, `combineTransports` | none |

## 4. Behaviour

**Inbox store.** One store per app. Actions apply at once and return to the previous state when the
server refuses; the unread total always ends as the server's number. Socket events and REST answers
carry the server's `unreadCount`; per-context counts are adjusted locally and fetched again when an
event names an item that is not loaded. Answers that arrive after a sign-out or a context change are
dropped. Signing out, or another person signing in, empties the store.

**Push.** The provider contract is `init`, `getPermission`, `requestPermission`,
`getSubscriptionId`, `onSubscriptionChange`, `onOpen`, `identify` and `forget`. The controller
registers the subscription on sign-in (`POST /notifications/devices`), keeps it in step with the
session, ties the install to the user id (the server reaches a person who never registered a device
by user id) and reports a tap with `POST /notifications/:id/opened`. Statuses: `disabled`, `idle`,
`unavailable`, `permission-needed`, `denied`, `enabled`.

**Realtime.** Mobile sends the access token in the handshake; web relies on the cookie. On
`auth:expiring` the session is renewed, then the new token is sent with `auth:refresh` (mobile) or
the socket reconnects (web). Reconnection uses a growing delay from 1 s to 30 s. `SESSION_REVOKED`,
`ACCOUNT_BLOCKED`, `TWO_FACTOR_REQUIRED` and `ORIGIN_NOT_ALLOWED` stop the attempts. A server-side
close without an `auth:expired` first is not retried automatically, because the server drops the
oldest socket past five per user and retrying would only move the problem to another device. After
every connection the inbox is fetched again if it was loaded.

## 5. Server contract

| Purpose | Routes (under `/api/v1/notifications`) |
|---|---|
| Inbox | `GET /`, `GET /unread-count`, `PATCH /:id/read`, `POST /:id/ack`, `POST /:id/opened`, `POST /read-all`, `DELETE /:id` |
| Preferences | `GET /preferences`, `PATCH /preferences`, `PATCH /settings` |
| Catalog | `GET /catalog` |
| Devices | `POST /devices`, `DELETE /devices/:subscriptionId` |
| Socket | path `/socket.io`; events `notification:new`, `notification:read`, `notification:deleted`, `auth:expiring`, `auth:expired`; client event `auth:refresh` |

Not covered, on purpose: `GET /admin/analytics`, `GET /admin/deliveries`, the whole `/marketing`
tree, `POST /webhooks/sms`.

## 6. Checks

- Unit tests for every module, with a fake socket, a fake push SDK and an in-memory server.
- `server-drift.test.ts` compares the contexts, priorities, channels, platforms and the 30 events
  (context, priority, mandatory, roles, channels, escalation) with the server source and Prisma
  schema.
- `npm run verify` also runs `publint` and `attw` on every entry point.
- CI: `.github/workflows/ci-notifications.yml`.

## 7. Not done

- Contract tests against the running API (the auth package has them). They need the throwaway
  PostgreSQL and Redis of the server integration suite.
- A real push through OneSignal, and the cold-start tap, on a device.
- The `/admin` entry (analytics, delivery lookup, marketing).
- Web push.
- Usage guides (Expo, Next.js, Vite) beyond the README.
