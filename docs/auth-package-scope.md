# swiftgoma-mp-auth: package scope (v1)

Shared authentication client for every SwiftGoma app. This file is the source of truth for what
the package is, what it leaves out, the decisions already taken and the build plan.

Location: `packages/auth`. npm name: `swiftgoma-mp-auth`.

---

## 1. Purpose

All SwiftGoma apps (buyer, seller and rider apps in Expo, a buyer web app and the admin dashboard
in Next.js or Vite) use the same auth API in `server/`. The delicate parts must be written, tested
and fixed once: token rotation, early refresh, the second login step, device identity and error
mapping.

- **The package owns:** transport, session, device identity and the auth flows.
- **Apps own:** screens, navigation, business logic and translations.

Principles:
- The same app code works on mobile and web, apart from the adapter.
- A user stays signed in across a day of use without ever seeing an expired-token error.
- A secret is never logged, and on the web no token is ever readable by JavaScript.
- Closing the app or a tab at any moment never leaves a broken session.

## 2. Decisions taken

| Topic | Decision |
|---|---|
| npm name | `swiftgoma-mp-auth` (unscoped; checked free on npm on 2026-10-29) |
| Location | `packages/auth`, an independent npm package (not part of a workspace); the apps install it from npm |
| Source language | TypeScript, compiled to JavaScript |
| Consumers | JavaScript and TypeScript projects; the package ships types, and plain JavaScript projects simply import it |
| Module formats | Both ESM and CommonJS, with types for each |
| Targets | Expo (Android, iOS), Next.js (App Router), Vite (single-page apps) |
| HTTP | Axios, as a peer dependency so the app and the package share one copy |
| Mobile tokens | Access and refresh token in secure storage |
| Web tokens | Cookies only; no token ever reaches JavaScript |
| Refresh | 5 minutes before expiry, configurable, with random spread (section 8) |
| Messages | French, passed through from the server unchanged |
| Passkeys | In v1, through a provider the app injects |
| Account features | Same package, separate subpath entries |
| React hooks | Yes, in a `/react` entry |
| Forgot and reset password | In v1 |
| Social sign-in | Off by default, switched on per app |
| Realtime (Socket.IO) | **Not part of this package.** A separate package uses this one (section 9) |
| Hosting | VPS, apps and API behind a reverse proxy (section 10) |

## 3. Open decisions

1. **Visibility.** An unscoped npm package is always public. The repository is marked proprietary,
   so publishing `swiftgoma-mp-auth` publishes its code to everyone. Either accept that, or change
   to a scoped name (for example `@swiftgoma-mp/auth`, which needs an npm organisation you own)
   and publish it as restricted, or use GitHub Packages. Decide before the first publish; it does
   not block building.
2. **Build tool and TypeScript version.** Chosen in phase 0 by reading the current official
   documentation. Candidates: tsdown, tsup, unbuild.
3. **Domain names** for the apps and the API (section 10).

## 4. Scope

**v1 (core)**
1. HTTP layer: client factory, interceptors, typed errors, constants.
2. Sign-up: email, phone, Google, Apple. Confirmation code, resend, role, terms and age
   confirmation.
3. Login: email code, phone code (with the "send it by email instead" channel), password, Google,
   Apple, passkey. Every login ends in one of three results.
4. Two-step verification at login (app code or backup code) and first-login enrollment for Support
   and Admin.
5. Step-up codes: one helper for every sensitive action.
6. Password: create, change, remove, forgot, reset.
7. Session and refresh: early refresh, single-flight, foreground refresh, 401 safety net.
8. Device identity.
9. Logout (this device or all), current user, list devices, disconnect a device.
10. Hand-off of the access token to the realtime package.
11. React bindings, test helpers, logging hook.

**Later, in the same package under separate entries (`/account`)**
- Manage 2FA (status, set up, confirm, disable, regenerate backup codes) and manage passkeys
  (register, list, rename, remove).
- Link Google or Apple to an existing account.
- Sign-in methods (list, remove) and secondary (recovery) contacts.
- Account recovery (5 steps), account activity, security checklist.
- Support request for suspended accounts.

**Staff entry (`/staff`), for the admin dashboard only**
- Create a Support account, staff setup link, resend, reset a member's 2FA, list and close support
  requests.

**Out of scope:** any UI, translations, push token registration, Socket.IO and the notifications
client, the provider libraries for Google, Apple and WebAuthn (they stay in the apps because they
need the app's own client IDs), and profile or product features.

## 5. Entry points

| Import | Contents | Peer dependencies |
|---|---|---|
| `swiftgoma-mp-auth` | Core: `createAuth`, errors, constants, types | `axios` |
| `swiftgoma-mp-auth/native` | Expo adapter: secure storage, device info, foreground events | none: the app passes `expo-secure-store` (and optionally `expo-device`, `AppState`) in |
| `swiftgoma-mp-auth/web` | Web adapter: cookies, device id, tab coordination | none |
| `swiftgoma-mp-auth/web/server` | Next.js helper to forward the visitor's cookies in server rendering | none |
| `swiftgoma-mp-auth/react` | `AuthProvider`, `useAuth`, `useSession`, `useCurrentUser` | `react` |
| `swiftgoma-mp-auth/account` | The "later" account features: `createAccount(auth)` | none |
| `swiftgoma-mp-auth/staff` | Admin dashboard operations | none |
| `swiftgoma-mp-auth/testing` | In-memory adapter and a fake server for apps' tests | none |

Output is ESM (`.js`) and CommonJS (`.cjs`), each with its own type declarations, an `exports`
map and `sideEffects: false`. A JavaScript project (CommonJS `require` or ESM `import`) works
without TypeScript installed; a TypeScript project gets the types automatically.

## 6. Public API (sketch, to be finalised in phases 4 to 7)

```
createAuth({ baseUrl, adapter, socials?, passkeys?, refreshMarginSeconds?, requestTimeoutMs?, logger? })

auth.signup.email / phone / google / apple         start, then verify / resend
auth.login.emailCode / phoneCode                   request, verify
auth.login.password / google / apple / passkey
auth.twoFactor.verify / enroll.start / enroll.confirm
auth.stepUp.request(channel?)                      sends the code; actions take stepUpCode
auth.password.create / change / remove / forgot / reset
auth.session                                       state, subscribe, getAccessToken, onTokenRefreshed, refreshNow
auth.logout() / auth.logoutAll() / auth.me()
auth.devices.list() / auth.devices.disconnect(id)
auth.socials.enabled
auth.api                                            the configured Axios client for the app's own calls
```

`baseUrl` is the API origin only; the package adds `/api/v1`. When the apps and the API share one
origin through the reverse proxy (section 10), `baseUrl` is the app's own origin.

## 7. Behaviours

**HTTP layer**
- Timeout (default 15 s), `Accept: application/json`; no `Authorization` header in cookie mode,
  bearer token otherwise (not on sign-up, login and refresh calls).
- Every failure becomes a typed error built from the server body
  `{ error: { code, message, details, requestId } }`: unauthorized, forbidden, not found, conflict,
  validation (with `fields`; the server answers 422), too many requests (with retry delay), server,
  network, timeout, not authenticated. The original Axios error stays as `cause`. The `requestId`
  is kept so support can trace a report.
- Cancellations pass through unchanged.
- Phase 1 deliverable: a catalogue of every error code the server can return, extracted from the
  server code, so the types are exact.

**Login results.** A login ends as one of: authenticated (user, `isNewDevice`); second code needed
(a challenge token valid 5 minutes, kept inside the package); or first-time 2FA enrollment needed
(Support and Admin).

**Transport follows the device platform.** The platform you send decides cookie or bearer: `WEB`
gets cookies and no tokens in the body; `ANDROID` and `IOS` get tokens in the body. The package
enforces that platform and adapter agree.

**Step-up codes.** A fresh code sent by `auth.stepUp.request()` is required for: creating,
changing or removing a password; linking Google or Apple; confirming 2FA; registering a passkey;
adding or removing a recovery contact; removing a sign-in method. The API takes it as a parameter
and the package never stores it.

**Device information.** The server reads only three fields: `deviceId` (8 to 128 characters,
stable per install), `deviceName` (up to 100) and `platform` (`ANDROID`, `IOS`, `WEB`). Anything
else is ignored.
- Mobile: a UUID generated once and kept in secure storage; the name from `expo-device` when
  available.
- Web: a UUID in local storage; a readable name such as "Chrome on Windows".
- A user can have up to 5 devices; the sixth login disconnects the oldest, which the package
  reports as a session end.

**Social sign-in.** The package asks the server for a one-time nonce, the app obtains an ID token
from the provider's own library for that nonce, and the package sends token and nonce. Apple gives
the name only the first time, so sign-up accepts an optional `name`. A disabled provider throws
`SocialLoginDisabled`.

**Passkeys.** The app injects a provider (`createCredential`, `getAssertion`) built on the
browser's WebAuthn or a native library; the package handles the server steps (options, verify).

**Logging and security.** The logger hook never receives tokens, codes or passwords. Tokens live
only in secure storage (mobile) or HttpOnly cookies (web). Error objects redact request bodies.

## 8. Session and refresh

- The access token lives 15 minutes, the refresh token 7 days. The server rotates the refresh
  token on every use and treats a replayed old one as theft.
- Therefore: one refresh at a time per app; never retry with an old token; on the web, coordinate
  across tabs (Web Locks), and a tab that finds another tab already refreshed adopts the result.
- Renew 5 minutes before expiry minus a random spread of up to 30 seconds. Also renew when the app
  returns to the foreground.
- A one-time retry after a 401 is a safety net, skipped if the session was renewed in the last few
  seconds.
- Network errors, timeouts, 5xx and 429 keep the session and retry with backoff (5, 15, 30, then
  every 60 seconds).
- Only the server's codes for an invalid, missing, reused or revoked refresh token, an expired
  session, or a suspended account end the session. The session exposes the reason.
- Staff on the web are signed out after 30 minutes idle, and staff accounts without confirmed 2FA
  are blocked from most routes.
- Expiry source: the server's `expiresIn`, then the token's own `exp` claim on mobile, then
  15 minutes.

## 9. Realtime and notifications: a separate package

Socket.IO is **not** part of this package. Reasons:
- Different concern: auth is the session; realtime is a live channel and the notifications inbox.
- `socket.io-client` is a heavy dependency that an app using only login should not install.
- Different release rhythm: events and the inbox will change more often than login.
- Auth stays small and easy to review, which matters for a security-sensitive package.

The hand-off is small and stable. This package exposes `getAccessToken()` and an
`onTokenRefreshed` event; the future package (for example `swiftgoma-mp-realtime`, name to be
decided) lists this one as a peer dependency.
- Mobile: the socket sends the access token in the handshake. When the server sends
  `auth:expiring`, the app calls `auth.session.refreshNow()` and answers with `auth:refresh` and
  the new token.
- Web: JavaScript cannot read the token, so after a refresh the socket reconnects and the cookie
  is sent again.
- Server side (later): let the web socket refresh by cookie, so reconnecting is not needed.

## 10. Hosting on a VPS

**Recommended layout.** Put each web app and the API behind one reverse proxy (for example Nginx)
so that the browser sees one origin per app. For instance, `app.example.com` serves the web app
and also forwards `/api/v1` and `/socket.io` to the API. Reasons:
- The access cookie uses the `__Host-` prefix, so it is bound to the exact host that set it. With a
  separate API host (`api.example.com`), a server-rendered Next.js page on `app.example.com` would
  never receive it. Same origin avoids this.
- No cross-origin requests, so no CORS surprises and no browser blocking of third-party cookies.
- HTTPS is mandatory (the `__Host-` cookie is Secure). Use Let's Encrypt on the VPS.

**Server settings that matter**
- `TRUST_PROXY` must be set to the number of proxies in front of the API. Without it every client
  looks like the same IP and the rate limits stop working (the server already warns about this).
- `CORS_ORIGINS` must list each web app origin. Cookie-based writes and refresh are refused from an
  unlisted `Origin`.
- For realtime later: the proxy must pass WebSocket upgrades (`Upgrade` and `Connection` headers)
  for `/socket.io`.

**Mobile apps** talk to the API's public HTTPS address and need none of this.

## 11. Server contract

Paths are relative to `<origin>/api/v1/auth`.

| Purpose | Routes |
|---|---|
| Sign-up | `POST /signup/email`, `/signup/phone`, `/signup/verify`, `/signup/resend`, `/signup/google`, `/signup/apple` |
| Login | `POST /login/otp/request`, `/login/otp/verify`, `/login/password`, `/login/google`, `/login/apple`, `/login/passkey/options`, `/login/passkey/verify` |
| Social nonce | `POST /oauth/nonce` returns `{ nonce }` |
| Two-step at login | `POST /2fa/verify`, `/2fa/enroll/setup`, `/2fa/enroll/confirm` |
| Session | `POST /refresh`, `POST /logout` (204), `POST /logout-all` (204), `GET /me`, `GET /sessions`, `DELETE /sessions/:id` |
| Step-up | `POST /step-up/otp` |
| Password | `POST /password`, `PUT /password`, `POST /password/remove`, `POST /password/forgot`, `POST /password/reset` |
| Account (later) | `GET /2fa`, `POST /2fa/setup`, `/2fa/confirm`, `/2fa/disable`, `/2fa/backup-codes`; `GET /passkeys`, `POST /passkeys/options`, `/passkeys/verify`, `PATCH` and `DELETE /passkeys/:id`; `POST /google/link`, `/apple/link`; `GET /methods`, `POST /methods/:method/remove`; `GET /secondary-contacts`, `POST /secondary-contacts/otp`, `/verify`, `/remove`; `POST /recovery/request`, `/verify`, `/contact`, `/complete`, `/cancel`; `GET /activity`, `GET /security`; `POST /support-request` |
| Staff (later) | `POST /staff`, `/staff/setup`, `/staff/:id/resend-setup`, `/staff/:id/reset-2fa`; `GET /support-requests`, `POST /support-requests/:id/close` |

Answers: mobile gets `{ user, accessToken, refreshToken, isNewDevice }`; web gets
`{ user, isNewDevice }` plus cookies. A 202 means a second step:
`{ twoFactorRequired, enrollment?, challengeToken, expiresIn }`. `POST /refresh` returns
`{ accessToken, refreshToken, expiresIn }` on mobile and `{ expiresIn }` on the web.

**Server changes needed for this package**
1. Return `expiresIn` on login, verify and enroll-confirm answers. Today only `/refresh` returns
   it, so the web package cannot schedule the first early refresh. **Required. Done:** all answers
   that open a session now carry `expiresIn`.
2. Optional `GET /auth/oauth/providers`, telling an app which social providers the server has
   configured. Recommended.
3. Optional: let the web socket refresh by cookie (section 9).
4. Each web app origin must be in `CORS_ORIGINS`.

## 12. Packaging and publishing

- Dual ESM and CommonJS builds with types, an `exports` map per entry point, `sideEffects: false`
  and a small `files` list. The package is independent of any workspace: it is installed from npm.
- Peer dependencies as in section 5; optional ones marked optional.
- Versioning with Changesets and a changelog. Stay on `0.x` until the contract tests pass, then
  follow semver. Keep a compatibility note between package versions and the server's `/api/v1`.
- A CI release job, a granular npm token, and 2FA on the npm account. Provenance
  (`--provenance`) only works from a public source repository, so skip it while the repository is
  private.
- Checks before every release: `publint` and "are the types wrong", and a smoke install in a
  throwaway Expo, Next.js and Vite app, from both `import` and `require`.
- Test that Metro (Expo), Next.js (with `transpilePackages` if needed) and Vite each resolve every
  entry point.

## 13. Testing

- **Unit tests** (Vitest) with fake timers for refresh, rotation, backoff and multi-tab behaviour;
  adapters tested against fakes.
- **Contract tests against the real server**, in mobile and web modes, reusing the server's
  integration harness (temporary PostgreSQL and Redis; the Windows runner exists). Cover sign-up,
  every login type, the three results, step-up, early refresh, rotation and reuse detection,
  logout, suspension and the device limit.
- **Test helpers** exported from `/testing` for apps.
- **Per-framework smoke apps** used only in CI.

## 14. Build plan

| Phase | Deliverable |
|---|---|
| 0 | Tooling decisions, skeleton in `packages/auth`, workspaces, CI that builds and tests |
| 1 | Constants, error catalogue extracted from the server, typed errors, Axios client and interceptors |
| 2 | Adapter contracts, mobile and web adapters, device identity, session store |
| 3 | Session manager: early refresh, single-flight, tab coordination, foreground refresh, 401 safety net |
| 4 | Sign-up and login (email, phone, password), the three results, logout, `me`, devices |
| 5 | Two-step verification and enrollment, step-up helper, password flows |
| 6 | Google and Apple, then passkeys through the provider |
| 7 | React bindings, test helpers, token hand-off for the realtime package |
| 8 | Contract tests against the real server, usage guides for Expo, Next.js and Vite, first release |
| 9 | `/account` entry (manage 2FA and passkeys, linking, methods, contacts, recovery, activity, security) |
| 10 | `/staff` entry for the admin dashboard |

The server change in section 11 (`expiresIn` on login) should land before phase 3 is finished.

## 15. Definition of done (v1)

- A user can sign up, log in with every method, finish two-step verification, and use Google,
  Apple and a passkey.
- The user stays signed in across a day of use with no visible 401.
- The same app code works on mobile and web apart from the adapter.
- Closing the app or a tab at any moment leaves a valid session.
- All contract tests pass against the current server, and each entry point installs and runs in an
  Expo, a Next.js and a Vite app, from both ESM and CommonJS.
- A first version is published under `swiftgoma-mp-auth`.

## 16. Risks

- **Visibility and licence.** A public, unscoped package exposes the code even though the
  repository is proprietary (section 3).
- **Apple.** A user who signed up with a real email and later uses Apple's hidden email gets a
  separate account; the apps must explain this. Apple sign-in on Android and the web needs Apple's
  web flow.
- **Cookies.** Browsers block cookies across different sites, and the `__Host-` cookie is
  host-bound. A wrong `CORS_ORIGINS` breaks refresh. Local development over plain HTTP may need a
  local HTTPS setup, and Safari is stricter than Chrome.
- **Passkeys in Expo** need native modules and a development build, not Expo Go.
- **Build tooling** moves quickly; pin versions and re-check before release.
- **Server drift.** The package depends on the server's error codes and answers, so the contract
  tests are the safeguard.
