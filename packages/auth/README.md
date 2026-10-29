# swiftgoma-mp-auth

Authentication client for SwiftGoma apps: sign-up, sign-in, two-step verification, session and
automatic token renewal, for React Native (Expo), Next.js and Vite. It talks to the `/api/v1/auth`
routes of the SwiftGoma server and nothing else.

> **Status: pre-release (0.x).** The API may still change until the first stable version.

- Phones keep the tokens in the secure storage of the device. Browsers never see a token: the
  server keeps the session in HttpOnly cookies.
- The access token is renewed 5 minutes before it expires, one request at a time, so the user never
  sees an expired-token error. Several browser tabs take turns.
- Every failure is a typed error (`ApiError` and subclasses) carrying the server error code.
- Works from JavaScript and TypeScript, as ESM or CommonJS.

## Install

```bash
npm install swiftgoma-mp-auth axios
```

`axios` (1.7 or later) is a peer dependency, so the app and the package share one copy. `react` is
an optional peer dependency, needed only for `swiftgoma-mp-auth/react`.

## What you import

| Import                         | What it is                                                         |
| ------------------------------ | ------------------------------------------------------------------ |
| `swiftgoma-mp-auth`            | `createAuth`, errors, error codes, types                           |
| `swiftgoma-mp-auth/native`     | Adapter for Expo (iOS, Android): secure storage, device name       |
| `swiftgoma-mp-auth/web`        | Adapter for browsers: device id, tabs, foreground events           |
| `swiftgoma-mp-auth/web/server` | Next.js: call the API from a server-rendered page as the visitor   |
| `swiftgoma-mp-auth/react`      | `AuthProvider`, `useAuth`, `useSession`, `useCurrentUser`          |
| `swiftgoma-mp-auth/account`    | Manage two-step verification, passkeys, linking, recovery, history |
| `swiftgoma-mp-auth/staff`      | Admin dashboard: staff accounts and support requests               |
| `swiftgoma-mp-auth/testing`    | A fake server and an in-memory adapter for your own tests          |

## Quick start

### Expo (iOS and Android)

The app gives the package the Expo modules it already uses, so the package needs none of them.

```ts
// auth.ts
import { createAuth } from "swiftgoma-mp-auth";
import { createNativeAdapter } from "swiftgoma-mp-auth/native";
import * as SecureStore from "expo-secure-store";
import * as Device from "expo-device";
import { AppState, Platform } from "react-native";

export const auth = createAuth({
  baseUrl: "https://api.swiftgoma.com",
  adapter: createNativeAdapter({
    os: Platform.OS,
    secureStore: SecureStore,
    device: Device, // optional: a readable device name
    appState: AppState, // optional: renew the session when the app comes back
  }),
});
```

```tsx
// App.tsx
import { AuthProvider, useSession } from "swiftgoma-mp-auth/react";

export default function App() {
  return (
    <AuthProvider auth={auth} onStartError={(error) => console.warn(error)}>
      <Root />
    </AuthProvider>
  );
}

function Root() {
  const session = useSession(); // { status: "unknown" | "authenticated" | "anonymous", user, ... }
  if (session.status === "unknown") return <Splash />;
  return session.status === "authenticated" ? <Home /> : <SignIn />;
}
```

On a phone, `status` becomes `anonymous` or stays `unknown` (tokens found) once `AuthProvider` has
read the secure storage. Call `auth.me()` to confirm the session with the server.

### Next.js (App Router) and Vite

```ts
// auth.ts
import { createAuth } from "swiftgoma-mp-auth";
import { createWebAdapter } from "swiftgoma-mp-auth/web";

export const auth = createAuth({
  // The origin of the API: the app origin when a reverse proxy serves both (see "Same origin").
  baseUrl: process.env.NEXT_PUBLIC_API_ORIGIN!, // Vite: import.meta.env.VITE_API_ORIGIN
  adapter: createWebAdapter(),
});
```

Use `AuthProvider` from a client component (in Next.js, a file that starts with `"use client"`).
In a browser the session is unknown at start: call `auth.me()` once to learn whether the visitor
is signed in. It renews an expired access cookie by itself.

```tsx
"use client";
import { useEffect } from "react";
import { AuthProvider, useAuth, useSession } from "swiftgoma-mp-auth/react";
import { auth } from "./auth";

export function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider auth={auth}>{children}</AuthProvider>;
}

export function RestoreSession() {
  const auth = useAuth();
  useEffect(() => {
    auth.me().catch(() => undefined); // anonymous visitors get a 401: that is fine
  }, [auth]);
  return null;
}
```

**Server-rendered pages (Next.js).** A server cannot set cookies for the browser, so it only reads:

```ts
import { headers } from "next/headers";
import { createServerClient, fetchCurrentUser } from "swiftgoma-mp-auth/web/server";

export async function getUser() {
  const client = createServerClient({
    baseUrl: process.env.API_ORIGIN!,
    cookie: (await headers()).get("cookie"),
  });
  return fetchCurrentUser(client); // the user, or null when the visitor is not signed in
}
```

**Same origin.** Put each web app and the API behind one reverse proxy so the browser sees one
origin: the access cookie is bound to the exact host that set it (`__Host-` prefix). Then
`baseUrl` is the app origin, and `CORS_ORIGINS` on the server must list it. See
`docs/auth-package-scope.md`, section 10.

## Signing in

Every sign-in call ends in one of three results:

```ts
const result = await auth.login.emailCode.verify({ email, code });

switch (result.status) {
  case "authenticated": // the session is open
    result.user; // { id, name, email, phone, role, status }
    result.isNewDevice; // true the first time this device signs in
    break;
  case "twoFactorRequired": // ask for the app code or a backup code
    await auth.twoFactor.verify({ code }); // or { backupCode }
    break;
  case "twoFactorEnrollmentRequired": // staff accounts, first sign-in
    const { secret, otpauthUri } = await auth.twoFactor.enroll.start(); // show a QR code
    const done = await auth.twoFactor.enroll.confirm({ code }); // done.backupCodes: show once
    break;
}
```

The token that links the first step to the second stays inside the package, in memory, for the 5
minutes the server accepts it.

| Method                                                       | Server route                           |
| ------------------------------------------------------------ | -------------------------------------- |
| `auth.signup.email(input)` / `.phone(input)`                 | `POST /auth/signup/email`, `/phone`    |
| `auth.signup.verify({ email \| phone, code })`               | `POST /auth/signup/verify`             |
| `auth.signup.resend({ email \| phone })`                     | `POST /auth/signup/resend`             |
| `auth.login.emailCode.request / verify`                      | `POST /auth/login/otp/request, verify` |
| `auth.login.phoneCode.request / verify` (`channel: "EMAIL"`) | same routes                            |
| `auth.login.password({ email, password })`                   | `POST /auth/login/password`            |
| `auth.login.google()` / `.apple()` / `.passkey()`            | see below                              |
| `auth.twoFactor.verify / enroll.start / enroll.confirm`      | `POST /auth/2fa/...`                   |
| `auth.stepUp.request({ channel? })`                          | `POST /auth/step-up/otp`               |
| `auth.password.create / change / remove / forgot / reset`    | `/auth/password...`                    |
| `auth.me()`, `auth.logout()`, `auth.logoutAll()`             | `/auth/me`, `/logout`, `/logout-all`   |
| `auth.devices.list()`, `auth.devices.disconnect(id)`         | `/auth/sessions`                       |

Sign-up needs the user to accept the terms and confirm their age: pass `acceptTerms: true` and
`confirmAge: true`.

### Google, Apple and passkeys

The package never imports a provider library: the app builds them with its own client IDs and
hands them in.

```ts
createAuth({
  baseUrl,
  adapter,
  socials: {
    google: { getIdToken: async (nonce) => /* ID token that carries this nonce */ },
    apple: { getIdToken: async (nonce) => /* ... */ },
  },
  passkeys: {
    getAssertion: async (options) => /* navigator.credentials.get(...) as JSON */,
    createCredential: async (options) => /* navigator.credentials.create(...) as JSON */,
  },
});

auth.socials.enabled; // { google: true, apple: true }
await auth.login.google();
await auth.signup.apple({ role: "BUYER", acceptTerms: true, confirmAge: true, name });
await auth.login.passkey();
```

A provider the app did not give throws `SocialLoginDisabledError` or `PasskeysDisabledError`
before any request is sent.

### Sensitive actions: step-up codes

Changing a password, linking a provider, adding a recovery contact or a passkey needs a fresh code:

```ts
await auth.stepUp.request(); // sends a code to a verified contact
await auth.password.change({ currentPassword, newPassword, code });
```

If the account has two-step verification, the code is the one from the authenticator app. The
package never stores a step-up code.

## The session

```ts
auth.session.getState(); // { status, user, accessExpiresAt }
auth.session.subscribe((state) => {}); // returns an unsubscribe function
await auth.session.getAccessToken(); // for a library that needs the token; null in a browser
auth.session.onTokenRefreshed((token) => {}); // new token, or null when the session ends
auth.session.onSessionEnded((reason) => {}); // an error code, e.g. "REFRESH_TOKEN_INVALID"
await auth.session.refreshNow();
auth.api; // the Axios client: tokens are sent and renewed for you
```

What the package does on its own:

- Renews the access token 5 minutes before it expires (random spread of up to 30 seconds), and
  again when the app comes back to the foreground. `refreshMarginSeconds` changes the margin.
- Sends one refresh at a time. The server rotates the refresh token on each use and treats a
  replayed one as theft, so two refreshes at once would end the session.
- Tabs of one browser take turns (Web Locks) and share the result (`BroadcastChannel`).
- If the server still answers that the token expired, refreshes and sends the request again, once.
- Keeps the session through no network, timeouts, server errors and rate limits, retrying after
  5, 15, 30 and then every 60 seconds. Only a refused session ends it: an invalid, missing,
  reused or revoked refresh token, an expired session or a suspended account.
- Closing the app or a tab at any moment leaves a valid session.

## Errors

```ts
import { hasErrorCode, isApiError, ValidationError, TooManyRequestsError } from "swiftgoma-mp-auth";

try {
  await auth.login.emailCode.verify({ email, code });
} catch (error) {
  if (hasErrorCode(error, "OTP_INVALID")) showWrongCode();
  else if (error instanceof ValidationError) form.setErrors(error.messagesByField);
  else if (error instanceof TooManyRequestsError) wait(error.retryAfterSeconds);
  else if (isApiError(error)) show(error.message, error.requestId); // French, from the server
}
```

`error.code` is a server code (`ERROR_CODES`) or one of `NETWORK_ERROR`, `TIMEOUT`,
`NOT_AUTHENTICATED`, `UNKNOWN_ERROR`, `SOCIAL_LOGIN_DISABLED`, `PASSKEYS_DISABLED`. `requestId`
lets Support find the request in the server logs. `isApiError` also works when an app ends up
with both the ESM and the CommonJS copy of the package.

## Logging

```ts
createAuth({ baseUrl, adapter, logger: (event) => console.debug(event.name, event.detail) });
```

Events: `refresh.start`, `refresh.ok`, `refresh.failed`, `refresh.busy`, `refresh.adopted`,
`session.ended`, `token.scheduled`, `token.retry`, `request.retried`. The detail holds names, error
codes, statuses and delays, never a token, a code, a password or a request body.

## Testing your app

```ts
import { createAuth } from "swiftgoma-mp-auth";
import { createFakeAuthServer, createTestAdapter } from "swiftgoma-mp-auth/testing";

const server = createFakeAuthServer();
server.addUser({ email: "gael@example.com", password: "secret123" });

const auth = createAuth({
  baseUrl: "https://api.test",
  adapter: createTestAdapter("ANDROID"),
  transport: server.transport,
});

await auth.login.password({ email: "gael@example.com", password: "secret123" });
server.expireAccessTokens(); // the next call renews the session by itself
server.setOffline(true); // requests fail like a lost connection
```

The fake server answers like the real one for sign-up, sign-in (code, phone code, password,
second step), refresh with rotation and reuse detection, `me`, logout and devices. Its
confirmation code is `server.code`.

## Account and staff features

```ts
import { createAccount } from "swiftgoma-mp-auth/account";
import { createStaff } from "swiftgoma-mp-auth/staff";

const account = createAccount(auth, { socials, passkeys });
await account.twoFactor.status();
await account.passkeys.register({ stepUpCode });
await account.methods.list();
await account.recovery.request({ email });
await account.activity({ category: "SECURITY" });

const staff = createStaff(auth); // admin dashboard
await staff.supportRequests.list({ status: "OPEN" });
```

## Compatibility

The package follows the SwiftGoma server's `/api/v1`. The server answers sign-in, sign-up and
enrollment with `expiresIn` (access token lifetime in seconds); the package falls back to the
token's own `exp` claim, then to 15 minutes.

## Development

```bash
npm run verify   # formatting, types, tests, build, publint and are-the-types-wrong
```

The tests include a check that every error code the server can return is in the package's
catalogue, and contract tests that run the package against the real server
(`server/tests/integration/authPackage.itest.mjs`).
