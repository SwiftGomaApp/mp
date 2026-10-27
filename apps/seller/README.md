# SwiftGoma MarketPlace (MP)

SwiftGoma MarketPlace is the marketplace for Goma, used from a phone. Buyers discover local shops, order products, pay with Mobile Money (cards later) and get delivery or pickup. Sellers present products, receive orders and manage their shop. Independent riders, verified by SwiftGoma, deliver the orders. The SwiftGoma team (Support and Admin) monitors the platform.

**Core promise:** the buyer's money is held safely until they confirm receipt by showing a **QR code**. The seller (and rider) are then paid automatically into their in-app wallet.

> Product specification: Google Doc "SwiftGoma MarketPlace" (in French).

---

## 1. Applications

| # | App | Audience | Tech | Location |
|---|-----|----------|------|----------|
| 1 | Buyer app | Buyers (mobile) | React Native + Expo | `apps/mobile-buyer` |
| 2 | Seller app | Shop owners (mobile) | React Native + Expo | `apps/mobile-seller` |
| 3 | Rider app | Delivery riders (mobile) | React Native + Expo | `apps/mobile-rider` |
| 4 | API docs | Developers | OpenAPI / Swagger UI (or Scalar) | `apps/docs` |
| 5 | Buyer web app | Buyers (browser) | Next.js | `apps/web-buyer` |
| 6 | Admin dashboard | SwiftGoma Support & Admin | Next.js | `apps/admin` |
| 7 | API server | All clients | Node.js + Express | `server` |

---

## 2. Tech stack

### Backend (`server`)

| Concern | Choice |
|---------|--------|
| Runtime / framework | Node.js + Express.js |
| Language | JavaScript (ES modules) |
| Database | PostgreSQL |
| ORM | Prisma |
| Cache | Redis |
| Queues & workers | BullMQ (on Redis) |
| Email | Nodemailer over Hostinger SMTP |
| SMS & WhatsApp | Twilio or Infobip (behind a provider interface) |
| Hashing | `bcryptjs` for passwords, Node `crypto` for OTPs, tokens, HMAC and QR codes |
| Secrets | Infisical (production) or `dotenv` (local) |
| Security | CORS, Helmet, rate limiting |
| Validation | Zod |
| Logging | Pino |
| Tests | Vitest or Jest + Supertest |
| API docs | OpenAPI 3 (Swagger) |

### Frontend (`apps`)

| App type | Stack |
|----------|-------|
| Web apps | Next.js (App Router), JavaScript |
| Mobile apps | React Native + Expo, JavaScript |
| Languages | French and English (i18n) |

---

## 3. Repository structure

```
mp/
├── .github/                 # GitHub configs (workflows, PR/issue templates, CODEOWNERS)
│   ├── workflows/
│   └── pull_request_template.md
├── apps/                    # All frontends
│   ├── web-buyer/           # Next.js buyer web app
│   ├── admin/               # Next.js admin dashboard (Support, Admin)
│   ├── docs/                # API documentation site
│   ├── mobile-buyer/        # Expo buyer app
│   ├── mobile-seller/       # Expo seller app
│   └── mobile-rider/        # Expo rider app
├── server/                  # The API (Node.js + Express)
├── .gitignore
└── README.md
```

### Server: feature-based MVVM

Each feature is a self-contained folder:

- **Model**: data and persistence (Prisma queries, repositories, domain rules).
- **ViewModel**: business logic and use cases (services).
- **View**: what the client sees (routes, controllers, validators, response DTOs).

```
server/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.js
├── src/
│   ├── app.js                  # Express app (middlewares, routes)
│   ├── server.js               # Entry point
│   ├── worker.js               # Queue workers entry point
│   ├── routes.js               # Mounts all feature routes under /api/v1
│   ├── config/                 # env, secrets loader (Infisical/dotenv), constants
│   ├── core/
│   │   ├── db/                 # Prisma client
│   │   ├── cache/              # Redis client + helpers
│   │   ├── queue/              # BullMQ queues + worker bootstrap
│   │   ├── mail/               # Nodemailer (Hostinger SMTP)
│   │   ├── messaging/          # SMS/WhatsApp provider interface (Twilio, Infobip)
│   │   ├── crypto/             # bcryptjs + crypto helpers (OTP, tokens, HMAC)
│   │   ├── middlewares/        # auth, roles, rate-limit, error handler, cors
│   │   ├── errors/             # AppError and error codes
│   │   └── utils/
│   ├── features/
│   │   ├── auth/
│   │   │   ├── model/          # auth.repository.js
│   │   │   ├── viewmodel/      # auth.service.js
│   │   │   ├── view/           # auth.routes.js, auth.controller.js,
│   │   │   │                   # auth.validators.js, auth.dto.js
│   │   │   └── index.js
│   │   ├── profile/            # profile, preferences, security, activity log
│   │   ├── verification/       # identity documents, contracts
│   │   ├── wallet/             # USD/CDF wallets, pending balance, withdrawals
│   │   ├── catalog/            # categories, shops, products, search, favorites
│   │   ├── cart/               # carts, promo codes
│   │   ├── order/              # checkout, order lifecycle, QR handover
│   │   ├── payment/            # Mobile Money, escrow, refunds
│   │   ├── delivery/           # rider assignment, live tracking
│   │   ├── review/
│   │   ├── dispute/
│   │   ├── notification/       # push, SMS, email, WhatsApp
│   │   └── admin/              # Support/Admin back-office, audit log
│   └── jobs/                   # queue processors and schedulers
│       ├── expire-unconfirmed-signups.job.js    # 3 days
│       ├── seller-response-timeout.job.js       # 15 min, reminder at 5 min
│       ├── payment-confirmation-timeout.job.js  # 5 min
│       ├── release-pending-balance.job.js       # 24 h hold
│       ├── auto-confirm-handover.job.js         # 48 h
│       ├── document-expiry-reminder.job.js      # 30 days before
│       ├── delete-account-final.job.js          # 30 days
│       └── exchange-rate-refresh.job.js         # weekly reference rate
├── tests/
├── .env.example
└── package.json
```

---

## 4. Main business rules

These come from the product specification.

- **Roles:** one role per account (Buyer, Seller, Rider, Support, Admin). Riders, Support and Admin accounts are created by SwiftGoma. A new Support or Admin account must be approved by a different Admin.
- **Auth:** email or phone OTP, email and password, Google, Apple, biometrics. Optional 2FA (mandatory for the team). Phone numbers are DRC only (`+243`). Up to 5 devices per account. A session ends after 7 days without use.
- **Prices:** delivery is always included in the price. Each shop uses a single currency (USD or CDF). The other currency is shown for reference only, using a weekly reference rate.
- **Escrow:** payment is held until the QR is scanned. Then the money is split: SwiftGoma commission, rider fee, seller remainder.
- **Wallet hold:** funds stay pending for 24 hours after the scan, to leave time to raise a problem.
- **Commission (launch grid, to be confirmed by Finance):** 12% under $20, 8% from $20 to $100, 5% above $100, on the product total after discount.
- **Seller response:** 15 minutes to accept or refuse. If there is no answer, the buyer is refunded automatically.
- **Verification:** sellers and riders submit documents, Support reviews, Admin decides (3 attempts). They also accept a contract in the app.
- **Account deletion:** 30-day grace period. Orders and payments are kept anonymised.

---

## 5. Getting started

### Prerequisites

- Node.js 20 LTS or newer
- npm (each app and the server have their own `package.json`)
- PostgreSQL 15 or newer
- Redis 7 or newer
- Expo Go on your phone for the mobile apps

### Install

```bash
git clone <repo-url> mp
cd mp

# Server
cd server && npm install && cd ..

# Frontends (repeat for each app you work on)
cd apps/web-buyer && npm install && cd ../..
```

### Configure the server

```bash
cd server
cp .env.example .env
```

Example `.env` (local, `dotenv`):

```env
NODE_ENV=development
PORT=4000
API_BASE_URL=http://localhost:4000
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002

DATABASE_URL=postgresql://user:password@localhost:5432/swiftgoma_mp
REDIS_URL=redis://localhost:6379

JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me
QR_HMAC_SECRET=change-me

# Hostinger SMTP
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=no-reply@yourdomain.com
SMTP_PASS=change-me
MAIL_FROM="SwiftGoma <no-reply@yourdomain.com>"

# SMS / WhatsApp: twilio | infobip
MESSAGING_PROVIDER=twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_WHATSAPP_FROM=
INFOBIP_BASE_URL=
INFOBIP_API_KEY=

# Google / Apple sign-in
GOOGLE_CLIENT_ID=
APPLE_CLIENT_ID=

# Secrets manager (production): infisical | dotenv
SECRETS_PROVIDER=dotenv
INFISICAL_CLIENT_ID=
INFISICAL_CLIENT_SECRET=
INFISICAL_PROJECT_ID=
INFISICAL_ENV=dev
```

Never commit `.env`. In production, set `SECRETS_PROVIDER=infisical` and load secrets from Infisical.

### Database

```bash
cd server
npx prisma migrate dev
npx prisma db seed
```

### Run

```bash
# API (http://localhost:4000)
cd server && npm run dev

# Queue workers (separate terminal)
cd server && npm run worker

# Web apps
cd apps/web-buyer && npm run dev      # http://localhost:3000
cd apps/admin && npm run dev          # http://localhost:3001
cd apps/docs && npm run dev           # http://localhost:3002

# Mobile apps
cd apps/mobile-buyer && npx expo start
cd apps/mobile-seller && npx expo start
cd apps/mobile-rider && npx expo start
```

---

## 6. API conventions

- Base path: `/api/v1`
- JSON only. Errors use a stable shape: `{ "error": { "code": "...", "message": "..." } }`
- Auth: `Authorization: Bearer <access_token>` plus a refresh token per device
- Pagination: cursor-based (`?cursor=...&limit=20`)
- Money: stored as integers (cents for USD, francs for CDF) with an explicit `currency` field
- Idempotency keys on payment, withdrawal and order creation
- Sensitive actions (change of phone, email, password or payout number, withdrawals) require a fresh OTP

---

## 7. Security checklist

- Passwords hashed with `bcryptjs`. OTPs and tokens stored hashed (SHA-256).
- OTPs are single-use and short-lived, with attempt limits and SMS rate limits (60 s between sends).
- Helmet, strict CORS allow-list, rate limiting on auth routes.
- Identity documents in private storage, every access logged.
- Audit log for admin actions, wallet movements and security changes.
- Webhook signature verification for payment providers.
- Secrets only from Infisical or environment variables, never in git.

---

## 8. Roadmap

1. Authentication, profile and security
2. Identity verification and contracts
3. Catalog: shops, products, search
4. Cart, checkout, Mobile Money payment (escrow)
5. Order lifecycle, rider delivery, QR handover
6. Wallets and withdrawals
7. Reviews, disputes, refunds
8. Admin dashboard (Support and Admin tools)
9. Card payments, promo codes, analytics

### Open decisions (from the spec)

- Withdrawal limits, fees and who pays them
- Card payment provider
- Required documents in the DRC
- Legal validity of in-app contract acceptance
- Retention period for identity documents
- Final commission grid (Finance)

---

## 9. Branching and contributing

### Branches

| Branch | Purpose |
|--------|---------|
| `main` | **Production.** Always stable and deployable. Only receives merges from `dev` (or hotfixes). |
| `dev` | **Default branch and development branch.** All work is merged here first. Deployed to staging. |
| `feat/<name>` | New feature, branched from `dev`, merged back into `dev`. |
| `fix/<name>` | Bug fix, branched from `dev`, merged back into `dev`. |
| `hotfix/<name>` | Urgent production fix, branched from `main`, merged into `main` and then back into `dev`. |

### Workflow

1. Branch from `dev`: `git checkout dev && git pull && git checkout -b feat/<name>`
2. Commit using Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`...).
3. Open a pull request into `dev`. CI (lint and tests) must pass and one review is required.
4. When `dev` is ready to release, open a pull request from `dev` into `main`. Merging it deploys to production.
5. Never commit directly to `main` or `dev`. Protect both branches on GitHub.

### Releases

Tag each production release on `main` (for example `v1.0.0`).

## 10. License

Proprietary. All rights reserved, SwiftGoma.