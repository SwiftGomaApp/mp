import type { PasskeyJson, PasskeyProvider, SocialProvider } from "swiftgoma-mp-auth";

/** The user closed the Google or passkey prompt, or no prompt could be shown. */
export class ProviderCancelledError extends Error {
  override name = "ProviderCancelledError";
}

const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

interface GoogleButtonOptions {
  type: "standard";
  theme: "outline" | "filled_blue" | "filled_black";
  size: "large";
  text: "continue_with";
  shape: "rectangular" | "pill";
  logo_alignment: "left" | "center";
  width: number;
}

interface GoogleIdApi {
  initialize(config: {
    client_id: string;
    nonce: string;
    callback: (response: { credential: string }) => void;
    ux_mode: "popup" | "redirect";
  }): void;
  renderButton(parent: HTMLElement, options: GoogleButtonOptions): void;
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

/**
 * Shows a small dialog holding Google's own "Continue with Google" button. A click on it opens
 * Google's account-chooser popup, which hands back the ID token. The page cannot start that popup
 * itself: only a click on Google's button can.
 */
function askGoogleIdToken(clientId: string, nonce: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const google = window.google;
    if (!google) return reject(new Error("Google script unavailable"));

    const overlay = document.createElement("div");
    overlay.className = "fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Continuer avec Google");

    const card = document.createElement("div");
    card.className =
      "flex w-full max-w-xs flex-col items-center gap-4 rounded-2xl border bg-background p-6 text-center text-foreground shadow-xl";

    const title = document.createElement("h2");
    title.className = "text-base font-semibold";
    title.textContent = "Continuer avec Google";

    const hint = document.createElement("p");
    hint.className = "text-xs text-muted-foreground";
    hint.textContent = "Cliquez ci-dessous, puis choisissez votre compte dans la fenêtre Google.";

    const buttonHost = document.createElement("div");
    buttonHost.className = "flex min-h-10 w-full justify-center";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className =
      "text-xs text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:underline";
    cancel.textContent = "Annuler";

    card.append(title, hint, buttonHost, cancel);
    overlay.append(card);

    function close(settle: () => void) {
      document.removeEventListener("keydown", onKeyDown, true);
      overlay.remove();
      settle();
    }

    const cancelPrompt = () => close(() => reject(new ProviderCancelledError()));

    // Captured first so Escape closes only this dialog, not the one the user opened it from.
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      cancelPrompt();
    }

    cancel.addEventListener("click", cancelPrompt);
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) cancelPrompt();
    });
    document.addEventListener("keydown", onKeyDown, true);

    google.accounts.id.initialize({
      client_id: clientId,
      nonce,
      ux_mode: "popup",
      callback: ({ credential }) =>
        close(() =>
          credential ? resolve(credential) : reject(new Error("Google returned no credential")),
        ),
    });
    google.accounts.id.renderButton(buttonHost, {
      type: "standard",
      theme: document.documentElement.classList.contains("dark") ? "filled_black" : "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      logo_alignment: "left",
      width: 260,
    });

    document.body.append(overlay);
  });
}

export function createGoogleProvider(clientId: string): SocialProvider {
  return {
    async getIdToken(nonce) {
      await loadGoogleScript();
      return askGoogleIdToken(clientId, nonce);
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
