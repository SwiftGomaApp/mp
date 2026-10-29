# apps

This folder holds the SwiftGoma front-ends. It is empty for now: the first app will be added here when it is rebuilt.

## Planned apps

| App | Audience | Tech |
|-----|----------|------|
| Buyer app | Buyers (mobile) | React Native + Expo |
| Seller app | Shop owners (mobile) | React Native + Expo |
| Rider app | Delivery riders (mobile) | React Native + Expo |
| Buyer web app | Buyers (browser) | Next.js |
| Admin dashboard | SwiftGoma Support and Admin | Next.js |

The API they all use lives in [`../server`](../server). Its Postman collection is in
[`../server/postman`](../server/postman).

## Adding an app

1. Create a folder here, for example `apps/buyer`.
2. Give it its own `package.json`. Every app is installed and run on its own.
3. Point it at the API with an environment variable (for example `EXPO_PUBLIC_API_URL`) and keep
   the real value in an untracked `.env` file. Never commit it.
4. Talk to the API under `/api/v1`. Sign in with the auth routes, send the access token as
   `Authorization: Bearer <token>`, and refresh it with `/auth/refresh`.

## History

An earlier buyer app (`apps/buyer`), placeholder folders for the other apps and a shared
`@swiftgoma/auth` package (`packages/auth`) used to live in this repository. They were removed.
Everything is still in git history, up to commit `454b679`. To look at or restore the old code:

```bash
git show 454b679:apps/buyer/package.json
git checkout 454b679 -- apps/buyer
```
