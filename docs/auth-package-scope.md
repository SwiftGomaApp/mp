# @swiftgoma/auth: package scope

Shared authentication client for every SwiftGoma app. This file is the source of truth for what
the package is, what it does not do, the decisions already taken, and the build plan.

Last updated: 2026-10-26. Branch: `feat/auth-package`.

---

## 1. Purpose

All SwiftGoma apps (buyer, seller and rider mobile apps, buyer web app, admin dashboard) talk to
the same auth API (`server/`). The delicate parts (token rotation, early refresh, the 2FA login
steps, device identity, error mapping) must be written, tested and fixed once, not once per app.

The package owns **transport, session and device**. Apps own screens and business logic.

## 2. Status

| # | Step | Status |
|---|------|--------|
| 1 | Skeleton and tooling | Done, verified |
| 2 | Constants and errors | Done, verified |
| 3 | Types and adapter contracts | Done, verified |
| 4 | Axios client and interceptors | Done, verified (107 tests, typecheck, build) |
| 5 | Session and early refresh | Code delivered in chat, **not applied yet** (see section 10) |
| 6 | Sign-up and login | Not started |
| 7 | Two-step verification | Not started |
| 8 | Google and Apple, with on/off switches | Not started |
| 9 | Mobile (Expo) adapter | Not started |
| 10 | Web adapter | Not started |
| 11 | Contract tests against the real server | Not started |
| 12 | Usage docs and examples | Not started |

Work one step at a time: the assistant gives the code in the chat, the owner pastes it, runs the
checks and reports the output before the next step.

## 3. Decisions already taken

- Name `@swiftgoma/auth`, location `packages/auth` at the repo root, next to `server/` and the
  planned `apps/`.
- **Delivery: npm workspaces in the monorepo** (no registry). Root `package.json` is private with
  `"workspaces": ["packages/*"]`. Add `"apps/*"` when the first app exists. `server/` stays
  **outside** the workspace (own `package.json` and lock file, Docker build unchanged).
- Language: TypeScript. Tests: Vitest 5. Build: **tsdown** (tsup is no longer maintained).
- **TypeScript is pinned to `~6.0.3`**: TypeScript 7 no longer provides the classic compiler API
  that tsdown's type-file generator needs. Revisit later by enabling `isolatedDeclarations`.
- Output: ESM (`.mjs`), CJS (`.cjs`) and types (`.d.mts`, `.d.cts`). Entry points: `.`, `./native`,
  `./web`. `fixedExtension: true`, `platform: "neutral"`.
- `axios` is a **peer dependency** (`^1.7.0`) so the app and the package share one copy.
- Mobile apps (React Native with Expo) keep an access and a refresh token in secure storage.
- Web apps (Next.js and Vite) use **cookies only**; no token is ever readable by JavaScript.
- Platform and transport must agree (enforced in `resolveConfig`): `WEB` means cookie, `ANDROID`
  and `IOS` mean bearer.
- Plain `http` base URLs are accepted only for local and private addresses.
- Social sign-in (Google, Apple) is **off by default** and switched on per app.
- Messages are French only; the package passes the server's messages through unchanged.
- Code style: Prettier from the repo root (width 100, double quotes, trailing commas).

## 4. Scope

### In the package
1. **HTTP layer**: client factory, interceptors, typed API exceptions, API constants.
2. **Sign-up**: by email, by phone, by Google, by Apple, with code confirmation, resend, role,
   terms and age confirmation.
3. **Login**: email code, phone code (with the "send it by email instead" channel), password,
   Google, Apple. Every login ends in one of three results: authenticated, second code needed,
   two-step enrollment needed.
4. **Two-step verification**: finish a login with the app code or a backup code; first-login
   enrollment for Support and Admin (secret and QR address, confirm, backup codes).
5. **Session and refresh**: renew the access token about 2 minutes before it expires so users never
   see a 401, plus a safety net on 401.
6. **Device information**: id, platform and name sent on every sign-up and login.
7. **Logout** (this device and all devices) and **current user** (`/auth/me`).
8. **Social on/off switches**: `socials: { google, apple }` per app; a disabled provider throws
   `SocialLoginDisabled` and `auth.socials.enabled` lists what the UI may show.

### Not in the package
Passkeys, forgot password (undecided, default out), account recovery, linking Google or Apple to
an existing account, profile and security screens, push token registration, any UI, translations.
React hooks (`useAuth`) are a possible later add-on.

## 5. Layout

```
packages/auth/
  package.json  tsconfig.json  tsdown.config.ts  vitest.config.ts
  src/
    core/     constants, errors, types, wire, adapters, config, memoryStore, http,
              (step 5) jwt, session; (step 6+) flows
    native/   Expo adapter: secure storage, device info, foreground hook
    web/      cookie mode, device id, tab coordination (Web Locks)
  tests/
```

`core` contains no platform code. `native` and `web` each supply a `PlatformAdapter`:
`platform`, `transport`, `store` (session store), `lifecycle` (foreground events), optional `lock`
(one refresh at a time across tabs), optional `userAgent`, and `getDeviceInfo()`.

## 6. Public API (sketch, to be finalised in steps 6 to 8)

```
createAuth({ baseUrl, adapter, socials?, refreshMarginSeconds?, requestTimeoutMs?, logger? })

auth.signup.email / phone / google / apple     start, then verify / finish
auth.login.emailCode / phoneCode               request, verify
auth.login.password / google / apple
auth.twoFactor.verify / enroll.start / enroll.confirm
auth.logout() / auth.logoutAll() / auth.me()
auth.session                                   state, subscribe
auth.socials.enabled
auth.api                                       configured Axios client for the app's own calls
```

`baseUrl` is the API origin only (for example `https://api.swiftgoma.com`); the package adds
`/api/v1`.

## 7. Behaviours

**HTTP layer**
- Base URL `<origin>/api/v1`, request timeout (default 15 s), `Accept: application/json`.
- Bearer mode: `Authorization: Bearer <token>`, skipped for calls marked `skipAuth` (sign-up,
  login, refresh), never overriding a header the caller set, stable `User-Agent` if provided.
- Cookie mode: `withCredentials`, never an `Authorization` header.
- Every failure becomes a typed error built from the server body
  `{ error: { code, message, details, requestId } }`: `UnauthorizedError`, `ForbiddenError`,
  `NotFoundError`, `ConflictError`, `ValidationError` (with `fields`), `TooManyRequestsError`
  (with `retryAfterSeconds`), `ServerError`, `NetworkError`, `TimeoutError`,
  `NotAuthenticatedError`. The original Axios error is kept as `cause`. Cancellations pass through
  unchanged.
- Response interceptors run first-in-first-out, request interceptors last-in-first-out; the 401
  recovery hook runs before errors are converted.

**Login results** (the second-step token is kept inside the package, never exposed)
- `authenticated` (user, isNewDevice)
- `two_factor_required` (challengeExpiresIn)
- `two_factor_enrollment_required` (challengeExpiresIn)

**Session and refresh**
- States: `unknown`, `authenticated`, `unauthenticated`, with an end reason (`logout`,
  `session_expired`, `session_revoked`, `token_reused`, `account_suspended`).
- Timer renews 120 s before expiry (configurable), with up to 15 s random spread, and also when
  the app returns to the foreground.
- One refresh at a time per app; on the web a lock coordinates tabs, and a tab that finds another
  tab already renewed the session adopts the result without calling the server (the server treats
  a rotated refresh token replayed after 60 s as theft).
- 401 safety net: on `TOKEN_EXPIRED`, or `UNAUTHORIZED` while signed in (an expired cookie simply
  vanishes), renew once and replay the request. Skipped if the session was renewed in the last
  10 s. A second 401 is surfaced.
- Temporary failures (offline, timeout, 5xx, 429) keep the session and retry after 5, 15, 30 and
  then every 60 s.
- Codes that end the session: `REFRESH_TOKEN_INVALID`, `REFRESH_TOKEN_MISSING`, `TOKEN_REUSED`,
  `SESSION_REVOKED`, `SESSION_EXPIRED`, `SESSION_NOT_FOUND`, `ACCOUNT_SUSPENDED`.
- `REFRESH_IN_PROGRESS` (409): wait 1 s and look again, up to twice.
- Expiry source: server `expiresIn`, then the token's `exp` claim, then 15 minutes.

**Device information** (server rules): `deviceId` 8 to 128 characters, stable per install (UUID in
secure storage on mobile, localStorage on web), `deviceName` up to 100 characters, `platform`
`ANDROID` | `IOS` | `WEB`.

**Socials**: ask the server for a nonce (`POST /auth/oauth/nonce`), the app obtains an ID token
from the provider's own library passing that nonce, the package sends token and nonce. Provider
libraries stay in each app (they need the app's own client IDs). Apple sign-up accepts an optional
`name` (Apple gives it only the first time).

## 8. Server contract

Paths are relative to `<origin>/api/v1`.

| Purpose | Method and path |
|---|---|
| Sign-up | `POST /auth/signup/email`, `/signup/phone`, `/signup/verify`, `/signup/resend`, `/signup/google`, `/signup/apple` |
| Login | `POST /auth/login/otp/request`, `/login/otp/verify`, `/login/password`, `/login/google`, `/login/apple` |
| Nonce | `POST /auth/oauth/nonce` returns `{ nonce }` |
| Two-step | `POST /auth/2fa/verify`, `/2fa/enroll/setup`, `/2fa/enroll/confirm` |
| Session | `POST /auth/refresh`, `POST /auth/logout` (204), `POST /auth/logout-all`, `GET /auth/me` |

Answers: mobile gets `{ user, accessToken, refreshToken, isNewDevice }`; web gets
`{ user, isNewDevice }` and cookies. A 202 answer means a second step:
`{ twoFactorRequired: true, enrollment?: true, challengeToken, expiresIn }` (valid 5 minutes).
`/auth/refresh` returns `{ accessToken, refreshToken, expiresIn }` on mobile (token in the body)
and `{ expiresIn }` on the web (cookie, needs an allowed `Origin`).

**Server changes this package depends on**
1. Return `expiresIn` on login, verify and enroll-confirm answers (**pending**; the web cannot read
   its HttpOnly token, so it needs it to schedule the early refresh).
2. `POST /auth/oauth/nonce` and `nonce` accepted by the Google validators (**done**).
3. Optional `GET /auth/oauth/providers` returning which socials the server has configured
   (**decision pending**); an app shows a social button only if the app enabled it and the server
   supports it.
4. Each web app origin in `CORS_ORIGINS`. The web app and the API must share a registrable domain
   (cookies are `SameSite=Lax`), or the web app calls the API through its own server.
5. For server-rendered Next.js pages, a helper that forwards the visitor's cookies to the API.

## 9. Environment and conventions

- Node 24 (`.nvmrc`), npm 11. Install and checks from the repo root:

```
npm install
npm run format
npm test
npm run typecheck
npm run build
```

- Deleting `node_modules` and the root `package-lock.json` and reinstalling fixes dependency
  resolution problems.
- `dist/` and `node_modules/` are git-ignored; commit the root `package-lock.json`.
- Expo SDK 58 configures Metro for workspaces automatically; Metro honours `package.json`
  `exports`. Next.js needs the package built (or `transpilePackages`).
- ESLint is not set up for the package yet (to be added after checking compatibility with the
  TypeScript version in use).
- Working rules for the assistant: give code in chat, never write to the owner's disk, never run
  git commands that change anything, read the official docs before using a new technology, add
  nothing that was not asked for.

## 10. Build plan and deliverables

**Step 5, session and early refresh (delivered, to be applied)**
- New: `src/core/jwt.ts` (`decodeJwtExpiry`, no reliance on `atob`), `src/core/session.ts`
  (`SessionManager`: `start`, `startSession`, `getAccessToken`, `refresh`, `refreshIfNeeded`,
  `endSession`, `destroy`, `subscribe`, `recoverFromUnauthorized`).
- Small edits: `constants.ts` (`NOT_AUTHENTICATED` client code, `DEFAULT_ACCESS_TOKEN_TTL_SECONDS`
  = 900, `REFRESH_LOCK_NAME`, `REFRESH_RETRY_DELAYS_MS`), `errors.ts` (`NotAuthenticatedError`),
  `adapters.ts` (optional `subscribe` on `SessionStore`), `core/index.ts` (export session).
- Tests: `tests/jwt.test.ts`, `tests/session.test.ts` (fake timers; includes an integration
  scenario with the HTTP client).
- The manager receives a `refreshCall(refreshToken | null)` function so it does not depend on the
  HTTP client; `createAuth` (step 6) wires them together.

**Step 6, sign-up and login**: wire format mapping, `createAuth`, signup (email, phone, resend),
login (email code, phone code, password), the three login results, internal challenge storage,
`startSession` after success, logout and logout-all, `me`.

**Step 7, two-step verification**: verify with code or backup code, enrollment (setup, confirm,
backup codes returned once).

**Step 8, Google and Apple**: nonce, login and sign-up for both, `socials` switches,
`SocialLoginDisabled`, `auth.socials.enabled`, development warning when an iOS build enables
Google without Apple (App Store guideline 4.8, check the current wording first).

**Step 9, mobile adapter**: `expo-secure-store` session store, device id and name, foreground hook
(`AppState`), stable User-Agent; verify on a real device that the User-Agent header is actually
sent.

**Step 10, web adapter**: cookie transport, device id in localStorage, session record (expiry
only) in localStorage with the `storage` event for other tabs, Web Locks for one refresh at a time,
helper to forward cookies in server rendering.

**Step 11, contract tests**: run the package against the real server using the integration test
harness in `server/tests/integration` (temporary PostgreSQL and Redis), in both mobile and web
modes. Cover sign-up, every login type, the three results, Google with a stubbed verifier, early
refresh, rotation, reuse detection, logout and suspension.

**Step 12, docs**: usage guide with one example for Expo and one for Next.js and Vite.

## 11. Definition of done

- A user can sign up, log in with every method, finish two-step, use Google and Apple, and stay
  signed in across a day of use without a visible 401.
- The same app code works on mobile and web apart from the adapter.
- Closing the app or a tab at any moment never leaves a broken session or a forced logout.
- All contract tests pass against the current server.

## 12. Risks and open decisions

- Forgot password in the package: default **out**.
- `GET /auth/oauth/providers`: default **yes**.
- Server `expiresIn` change: default **yes**.
- React hooks: **later**.
- Apple private relay email: a user who signed up with a real email and later uses Apple's hidden
  email gets a separate account (accounts link only on a matching verified email). Apps must
  explain this on the sign-in screen.
- Apple on Android and web needs Apple's web flow (Services ID and redirect page); some apps may
  leave Apple off.
- A wrong web origin in `CORS_ORIGINS` makes every refresh fail and the package retries every
  60 s; the web adapter should make this failure loud.
- tsdown is pre-1.0 (0.23.x): expect small option changes between versions.

## 13. Resuming with the assistant

Give it this file and say: "Continue the @swiftgoma/auth package from `docs/auth-package-scope.md`.
Steps 1 to 4 are applied and verified. Step 5 was delivered but not applied; regenerate it from
section 10 if I do not have it. Give code in chat only, one step at a time."
