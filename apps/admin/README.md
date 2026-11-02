# SwiftGoma Admin

Admin console (Next.js) for SwiftGoma **Support** and **Admin** accounts. Any other role is refused at
sign-in, by the server-side gate of the `(protected)` layout, by the client guard, and by the server.

```bash
cp .env.example .env.local   # NEXT_PUBLIC_API_ORIGIN = API origin, without /api/v1
npm install
npm run dev                  # http://localhost:3001
npm run typecheck && npm run lint && npm run build
```

Uses `swiftgoma-mp-auth` (sign-in, 2FA, step-up, devices, staff) and `swiftgoma-mp-notifications`
(inbox, preferences, live updates). The browser session lives in HttpOnly cookies, so serve the app and
the API from one origin (reverse proxy) and list the app origin in the server's `CORS_ORIGINS`.

| Page | Server routes |
| ---- | ------------- |
| `/users`, `/users/[id]` | `/admin/users`, `/admin/users/:id`, `/activity`, and every action (ADMIN only, except the 3 reads) |
| `/audit` | `GET /admin/activity` (ADMIN) |
| `/verification`, `/verification/[id]` | `/admin/verification/cases...` (approve/reject: ADMIN) |
| `/staff` | `/auth/staff`, `/auth/support-requests` |
| `/notifications`, `/notifications/settings` | `/notifications` |
| `/account`, `/login`, `/setup`, `/forgot` | `/auth` |
