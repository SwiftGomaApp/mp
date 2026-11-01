# Web app: what still needs the backend

Snapshot of `apps/web` against the routes the server mounts today (`health`, `auth`, `admin`,
`notifications`, `marketing`). Written on 2026-11-01. Update it as features land.

Legend: `[ ]` to do, `[x]` done.

---

## 1. Forms that pretend to send

These forms call a fake `setTimeout` marked `TODO`. The UI is ready; the endpoint is missing.

- [ ] **General contact request.** Used by the `/contact` form (`components/contact/support-form.tsx`)
  and the `/help` contact form (`components/help/help-contact-form.tsx`).
  - Open to anyone, signed in or not.
  - Body: topic, optional order reference, e-mail or phone, message (10 to 1000 characters).
  - Lands in the Support queue (same back office as the suspended-account requests).
  - Note: `POST /auth/support-request` exists but is built for suspended accounts. It takes exactly
    one of e-mail or phone plus a message, with no topic or order reference.
- [ ] **Newsletter subscription.** Used by `components/global/newsletter-form.tsx`. Should plug into
  the existing `marketing` feature (segments, campaigns, suppressions) and respect suppressions.

## 2. Pages showing hard-coded content

- [ ] **Seller testimonials** on `/sell` (`lib/sell.ts`): a list of approved testimonials plus one
  featured, shaped `{ id, quote, name, detail }`.
- [ ] **About page figures** (`app/(main)/about/page.tsx`): real counts, if live numbers are wanted.
- [ ] **Commission grid** shown on `/how-it-works` and `/partners`: one source of truth for the
  tiers and thresholds (12 % under $20, 8 % from $20 to $100, 5 % above $100, to be confirmed by
  Finance).
- [ ] **Reference exchange rate** (weekly) for the indicative "environ ... francs" price display.

## 3. Public pages missing because the feature is not on the server

The header, footer and menus already link to these. They return 404 today.

- [ ] **Catalog:** categories, shops, products, search, sorting by distance, favorites.
  Needed for `/shops`, `/categories`, shop and product pages, `/favorites`.
- [ ] **Cart and checkout:** one cart per shop, promo codes, checkout. Needed for `/cart`.
- [ ] **Orders:** order lifecycle, live tracking, QR handover. Needed for `/orders`.
- [ ] **Payment:** Mobile Money with escrow, refunds, 5-minute confirmation window.

## 4. Seller and rider journeys promised by the marketing pages

`/sell`, `/deliver` and `/partners` tell people to apply, but there is no screen or server feature
behind it yet.

- [ ] **Verification:** document upload (ID and selfie, trade register, tax number, shop photos for
  sellers; ID and selfie, permit, vehicle and plate photos for riders), Support review then Admin
  decision, 3 attempts.
- [ ] **Contract acceptance** in the app with a PDF copy.
- [ ] **Shop activation status:** what is left to do (contract, recovery contact, payout number).
- [ ] **Rider to shop linking:** link requests accepted by the shop.
- [ ] **Wallets and withdrawals:** USD and CDF balances, 24 h pending balance, Mobile Money
  withdrawals with limits and fees.
- [ ] **Reviews, disputes** and the 7-day reporting window.
- [ ] **Decision to make:** the README says riders are created by SwiftGoma, but the rider terms and
  the web pages say riders apply themselves. The server must match the chosen rule.

## 5. Notifications

Connected in the web app: bell and sheet, inbox, preferences, live socket.

- [ ] **Emit the missing events.** Only `account.welcome` and the security events are emitted today.
  `order.*`, `sale.*`, `delivery.*`, `support.*`, `admin.*`, payouts and disputes need their
  features first (sections 3 and 4).
- [ ] **Production settings:** `ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY`, and the real web domain
  (with `https://`) in `CORS_ORIGINS`, or the socket stops with `ORIGIN_NOT_ALLOWED`.
- [ ] **Real delivery tests** through OneSignal, SMTP and Africa's Talking (none sent yet), including
  the SMS fallback after 2 minutes and the Africa's Talking callback URL.
- [ ] **Web push** (needs the next version of `swiftgoma-mp-notifications`): check that a `WEB`
  subscription receives pushes, and add a click-through link to the push payload.

## 6. Smaller loose ends

- [ ] **Security checklist** in the profile (`lib/security.ts`): the buttons only print to the
  console; the setup flow for each task is not built.
- [ ] **Dynamic sitemap** (`app/sitemap.ts`, `app/robots.ts`): add shops and products once the
  catalog exists.

## Already working

Sign-up and sign-in, 2FA, passkeys, account recovery, devices, activity, linked accounts, the
suspended-account support request, and notifications (inbox, preferences, live socket).

## Suggested order

1. Contact and newsletter endpoints (small, the UI is ready).
2. Catalog, then cart, checkout and payment (the buyer front door).
3. Verification, contracts, wallets (the seller and rider journeys).
4. Emit the notification events as each feature lands, then web push.
