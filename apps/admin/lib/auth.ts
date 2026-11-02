import { createAuth } from "swiftgoma-mp-auth";
import { createWebAdapter } from "swiftgoma-mp-auth/web";
import { createStaff } from "swiftgoma-mp-auth/staff";

import { browserPasskeys, createGoogleProvider } from "@/lib/auth-providers";
import { isStaffRole } from "@/lib/roles";

export const apiOrigin = process.env.NEXT_PUBLIC_API_ORIGIN;
const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

if (!apiOrigin) {
  throw new Error("NEXT_PUBLIC_API_ORIGIN is not set (see apps/admin/.env.example)");
}

export const auth = createAuth({
  baseUrl: apiOrigin,
  adapter: createWebAdapter(),
  socials: googleClientId ? { google: createGoogleProvider(googleClientId) } : {},
  passkeys: browserPasskeys,
});

export const staff = createStaff(auth);

// Defence in depth: the server checks the role on every route, and the console also never sends
// a request for a session that is not Support or Admin (sign-out and sign-in calls stay possible).
auth.api.interceptors.request.use((config) => {
  const user = auth.session.getState().user;
  if (user && !isStaffRole(user.role) && !config.url?.startsWith("/auth/")) {
    return Promise.reject(new Error("Accès réservé au personnel SwiftGoma"));
  }
  return config;
});
