# Notification system: scope (v1)

How SwiftGoma tells every user what happened, through the right channel at the right time. This
file is the source of truth for the decisions taken, what exists on the server today, what is left
and what is out of scope.

Last updated: 2026-10-29. Server code: `server/src/features/notifications`,
`server/src/features/marketing`, `server/src/core/realtime`.

---

## 1. Goal

One reliable system where code says **what happened** and **who it is for**, and the system decides
the channel. No feature chooses email, SMS or push by itself.

```
await notify({ event: "order.out_for_delivery", userId, data: { orderId, orderNumber } });
```

## 2. Decisions taken

| Topic | Decision |
|---|---|
| Channels | In-app (inbox plus live delivery), push, SMS, email |
| Push provider | OneSignal, called from the server with plain HTTPS (no extra package) |
| Live delivery | Socket.IO with the Redis adapter |
| SMS provider | Africa's Talking (existing), with a daily budget for alerts |
| Marketing | **Email only**. Never SMS or push |
| Language | French only. Other languages are the next phase |
| WhatsApp | Not in v1. Next phase |
| Roles | One role per user: buyer, seller, rider, support, admin |
| Buying | Every role can buy, except a seller cannot buy their own products. Purchase notifications therefore go to any role |
| Inbox | One inbox per user, grouped by context (see section 5) |
| Codes and links | OTP codes and the staff setup link never go through the dispatcher: they are not stored in the inbox and never pushed |
| Admin console | A new web app, not built yet. The server APIs for it exist |

## 3. Channels

| Channel | Used for |
|---|---|
| In-app | Every notification. The inbox row is the source of truth and cannot be switched off by the user. Socket.IO pushes new items live while the app is open |
| Push | Alerts when the app is closed. Generic text only on the lock screen (no codes or amounts) |
| SMS | Security alerts when the user has no verified email, and escalation of urgent notifications |
| Email | Receipts, security alerts, account lifecycle, and all marketing |

## 4. Routing rules

1. The **inbox row is always written**, then the other channels are decided.
2. **Mandatory** events (security, rider assignments, admin alerts) ignore preferences and quiet
   hours.
3. **Critical** events ignore quiet hours but respect an explicit "off".
4. **Push is skipped when the user is online** (live socket), unless the event is high or critical.
5. **SMS fallback:** for events marked this way, SMS is sent only when the user has **no verified
   email**. If the user simply turned email off, no SMS is sent either.
6. **Throttling:** at most 30 non-urgent notifications per user per hour reach push, email or SMS
   (the inbox still gets them). An event can also declare its own limit.
7. **Quiet hours** (per user, in their time zone, default `Africa/Lubumbashi`) hold back
   non-critical push only.
8. **Preferences** are per category and channel, stored only when the user turned something off.
   Security cannot be switched off.
9. A person can be reached at **explicit contacts** when the caller says so, for example the
   previous contacts after an account recovery replaced them. Each email or SMS delivery stores the
   address it was meant for.
10. Suspended or banned users get nothing except security notices; deleted users get nothing.
11. Push goes only to devices whose login session is still alive. A user who never registered a
    device is reached by user id.
12. Notifications expire after 90 days and are deleted by a daily job.

## 5. Contexts and events (30 at launch)

Contexts: SECURITY, PURCHASE, SALE, DELIVERY, SUPPORT, ADMIN, ANNOUNCEMENT, MARKETING.

| Audience | Events |
|---|---|
| Everyone, security (mandatory) | `security.alert` (17 kinds, for example password changed, 2FA switched, contact changed), `security.recovery` (email and SMS), `security.login.new` |
| Everyone, lifecycle | `account.welcome` (once), `announcement.platform` |
| Any role as a buyer | `order.placed`, `payment.confirmed`, `payment.failed`, `accepted`, `rejected`, `out_for_delivery`, `delivered`, `cancelled`, `refunded` |
| Seller | `sale.order.new` (critical, SMS after 5 min unread), `order.cancelled`, `stock.low`, `payout.sent`, `dispute.opened` |
| Rider | `delivery.assignment.new` (critical, mandatory, SMS after 2 min unread), `assignment.cancelled` (mandatory), `pickup.ready`, `issue.reported`, `payout.sent` |
| Support | `ticket.assigned`, `ticket.reply`, `sla.breaching` (critical) |
| Admin | `alert.system` (mandatory), `seller.pending`, `dispute.high` |

Escalation stops as soon as the notification is read or acknowledged. Not covered yet: chat
messages (there is no messaging module).

## 6. Realtime

Socket.IO on the API server, scaled across instances with the Redis adapter. The worker process
emits through the same adapter.

- **Authentication:** the access token (mobile) or the cookie (web). A cookie handshake must come
  from an allowed origin. Suspended or banned accounts, and staff without 2FA, are refused.
- **Rooms:** `user:<id>`, `session:<sessionId>`, `role:<ROLE>`. Revoking a session closes its
  sockets on every instance.
- **Limits:** 60 new connections per minute per address, 5 sockets per user (the oldest is
  dropped).
- **Token expiry:** the server sends `auth:expiring` about a minute before the token ends; mobile
  answers with `auth:refresh` and a new token; the web reconnects with the refreshed cookie.
- **Events to the client:** `notification:new` `{ notification, unreadCount }`,
  `notification:read` `{ ids | all, context?, unreadCount }`, `notification:deleted`
  `{ ids, unreadCount }`.
- The inbox over REST is the source of truth; after a reconnect the app refetches.

## 7. API (all under `/api/v1`)

**Notifications** (signed in)

| Route | Purpose |
|---|---|
| `GET /notifications` | Inbox page (cursor, `limit`, `context`, `unread`) |
| `GET /notifications/unread-count` | Badge total and per context |
| `GET /notifications/catalog` | Event types the signed-in role can receive (context, priority, mandatory, channels, escalation) |
| `PATCH /notifications/:id/read` | Mark one as read |
| `POST /notifications/:id/ack` | Acknowledge (also marks read, stops escalation) |
| `POST /notifications/:id/opened` | The app was opened from a push; recorded once per sent push, shown as `pushOpened` in the admin analytics |
| `POST /notifications/read-all` | Mark all, or one context, as read |
| `DELETE /notifications/:id` | Delete one |
| `GET /notifications/preferences` | Categories and channels for the user's role |
| `PATCH /notifications/preferences` | Turn a channel on or off per category |
| `PATCH /notifications/settings` | Time zone, quiet hours, marketing email consent |
| `POST /notifications/devices` | Register a OneSignal subscription |
| `DELETE /notifications/devices/:subscriptionId` | Remove it (on logout) |
| `GET /notifications/admin/analytics` | Delivery results by channel (Admin) |
| `GET /notifications/admin/deliveries` | "Did this person get it?" (Support, Admin) |

**Webhook:** `POST /webhooks/sms?key=...` receives Africa's Talking delivery reports.

**Marketing** (Admin only, under `/marketing`): segments (list, create, get, update, delete,
preview), email templates (list, create, get, update with versioning), campaigns (list, create,
get, update, delete, schedule, send now, cancel, test, stats, recipients), suppression list (list,
add, lift a bounce), overview analytics. **Public links** inside emails under `/marketing/p`: open
pixel, tracked link, unsubscribe page and one-click unsubscribe.

The Postman collection in `server/postman` covers all of these.

## 8. Marketing (email only)

- **Audience rules:** always active customers (buyer, seller, rider; never staff) with a verified
  email who opted in and are not suppressed. A segment can narrow by role, platform, city, last
  login, inactivity, sign-up date and verification status.
- **Consent:** off by default, switched on by the user. Unsubscribing switches it off and
  suppresses the address. Only a bounce can be lifted by an admin; unsubscribes and complaints must
  be reversed by the person.
- **Campaign life:** draft, scheduled, sending, sent, cancelled, failed. A started campaign freezes
  its audience and re-checks consent when each message is sent.
- **Sending:** its own queue, paced at 120 emails a minute by default (a new sender warms up
  gradually), at most 50,000 recipients per campaign. An optional separate sender keeps promotions
  from harming the sender that delivers login codes.
- **Tracking:** opens and clicks through signed links (a link can never redirect anywhere that was
  not signed into the email), a visible unsubscribe link and the one-click unsubscribe header.
- **Results:** sent, failed, skipped, unique opens and clicks, unsubscribes and top links. "Sent"
  means the mail server accepted the message; plain email gives no delivery receipt, and opens are
  an estimate because some mail apps load images for everyone.
- **Bounces:** plain SMTP gives no automatic feed, so an admin records bounces and complaints.

## 9. Data (PostgreSQL, Prisma)

`Notification`, `NotificationDelivery` (per channel, with status, attempts, target address),
`NotificationPreference`, `NotificationSettings`, `DeviceRegistration`, `EmailTemplate` and
`EmailTemplateVersion`, `Segment`, `Campaign`, `CampaignRecipient`, `EmailSuppression`,
`TrackingEvent`.

Migrations: `add_notifications`, `add_marketing`, `add_delivery_target`, `add_delivery_opened`.

## 10. Configuration

| Variable | Purpose |
|---|---|
| `ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY`, `ONESIGNAL_TIMEOUT_MS` | Push (required in production) |
| `PUSH_DRY_RUN` | Log pushes instead of sending (must be false in production) |
| `SMS_DAILY_ALERT_LIMIT` | Daily budget for alert SMS (0 means unlimited) |
| `AT_WEBHOOK_SECRET` | Secret key in the Africa's Talking callback URL |
| `MARKETING_LINK_SECRET` | Signs email links (derived from another secret if empty) |
| `MARKETING_EMAILS_PER_MINUTE`, `MARKETING_MAX_RECIPIENTS` | Sending pace and audience limit |
| `MARKETING_MAIL_FROM`, `MARKETING_SMTP_*` | Optional separate marketing sender |
| `TRUST_PROXY`, `CORS_ORIGINS` | Behind the VPS reverse proxy: proxy count, allowed web origins |

Processes: the API server and the worker (`npm run worker:start`) both run, with PostgreSQL and
Redis. The reverse proxy must pass WebSocket upgrades for `/socket.io`.

## 11. Status

**Built and checked on the server**
- Dispatcher, event catalog, preferences, inbox and device APIs, push, email and SMS delivery with
  retries, escalation, throttling, SMS webhook, cleanup job, realtime, and the whole marketing
  engine with its admin APIs.
- Auth flows (login alert, welcome, security and recovery alerts) go through the dispatcher.
- Checks: lint, 318 unit tests, and the integration suite (205 tests, run against a throwaway
  PostgreSQL and Redis).

**Not done**
- No message has been sent through the real OneSignal, SMTP or Africa's Talking yet.
- The admin web app and every client app (inbox, preferences, push registration, socket client).
- Wiring: only the auth flows call `notify()`. Orders, payments, deliveries, payouts, disputes,
  support tickets and admin alerts have no server modules yet.
- OneSignal delivery receipts (the app already reports push opens), and automatic cleanup of dead push subscriptions.
- Automatic email bounce handling (needs a provider with webhooks).
- Segments or conversions based on order history (needs an orders model).
- Chat message notifications.
- Transactional email templates stay in code; the console edits marketing templates only.
- Alerts and a dashboard for failed notifications.
- A screen asking users for marketing consent at sign-up.

## 12. Out of scope for v1

WhatsApp, languages other than French, marketing through SMS or push, and notifications for
third-party systems or partners.

## 13. Open items

1. Provider setup: OneSignal (FCM and APNs credentials), the Africa's Talking callback URL, and a
   marketing sender domain with SPF, DKIM and DMARC.
2. Escalation delays (5 min for sellers, 2 min for riders) and the 30 per hour cap are starting
   values to tune with real traffic.
3. The old per-type alert queue functions and handlers are kept so jobs queued before the change
   still finish; remove them once the queue is empty after deploy.
4. The Africa's Talking delivery-report field names come from a third-party guide; confirm with a
   real callback.
