import type { PasskeyJson, PasskeyProvider, SocialProvider } from "swiftgoma-mp-auth";

/** The user closed the Google or passkey prompt, or no prompt could be shown. */
export class ProviderCancelledError extends Error {
  override name = "ProviderCancelledError";
}

const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

interface GoogleNotification {
  isNotDisplayed(): boolean;
  isSkippedMoment(): boolean;
  isDismissedMoment(): boolean;
  getDismissedReason(): string;
}

interface GoogleIdApi {
  initialize(config: {
    client_id: string;
    nonce: string;
    callback: (response: { credential: string }) => void;
    use_fedcm_for_prompt?: boolean;
    cancel_on_tap_outside?: boolean;
  }): void;
  prompt(listener: (notification: GoogleNotification) => void): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

let googleScript: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  googleScript ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      googleScript = null;
      script.remove();
      reject(new Error("Google script failed to load"));
    };
    document.head.appendChild(script);
  });
  return googleScript;
}

export function createGoogleProvider(clientId: string): SocialProvider {
  return {
    async getIdToken(nonce) {
      await loadGoogleScript();
      const google = window.google;
      if (!google) throw new Error("Google script unavailable");

      return new Promise<string>((resolve, reject) => {
        google.accounts.id.initialize({
          client_id: clientId,
          nonce,
          callback: ({ credential }) => resolve(credential),
          use_fedcm_for_prompt: true,
          cancel_on_tap_outside: false,
        });
        google.accounts.id.prompt((notification) => {
          const dismissedByUser =
            notification.isDismissedMoment() &&
            notification.getDismissedReason() !== "credential_returned";
          if (notification.isNotDisplayed() || notification.isSkippedMoment() || dismissedByUser) {
            reject(new ProviderCancelledError());
          }
        });
      });
    },
  };
}

export const browserPasskeys: PasskeyProvider = {
  async getAssertion(options) {
    const publicKey = PublicKeyCredential.parseRequestOptionsFromJSON(
      options as unknown as PublicKeyCredentialRequestOptionsJSON,
    );
    const credential = await navigator.credentials.get({ publicKey });
    if (!(credential instanceof PublicKeyCredential)) throw new ProviderCancelledError();
    return credential.toJSON() as unknown as PasskeyJson;
  },
  async createCredential(options) {
    const publicKey = PublicKeyCredential.parseCreationOptionsFromJSON(
      options as unknown as PublicKeyCredentialCreationOptionsJSON,
    );
    const credential = await navigator.credentials.create({ publicKey });
    if (!(credential instanceof PublicKeyCredential)) throw new ProviderCancelledError();
    return credential.toJSON() as unknown as PasskeyJson;
  },
};
