import { createAuth } from "swiftgoma-mp-auth";
import { createWebAdapter } from "swiftgoma-mp-auth/web";

import { browserPasskeys, createGoogleProvider } from "@/lib/auth-providers";

const baseUrl = process.env.NEXT_PUBLIC_API_ORIGIN;
const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

if (!baseUrl) {
  throw new Error("NEXT_PUBLIC_API_ORIGIN is not set (see apps/web/.env.local)");
}

export const socials = googleClientId ? { google: createGoogleProvider(googleClientId) } : {};

export const auth = createAuth({
  baseUrl,
  adapter: createWebAdapter(),
  socials,
  passkeys: browserPasskeys,
});
