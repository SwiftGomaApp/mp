import { hasErrorCode } from "swiftgoma-mp-auth";

import { account } from "@/lib/account";
import { auth } from "@/lib/auth";

export interface StepUp {
  authenticator: boolean;
  sentTo: string | null;
  /** A code was already sent a moment ago: the server will not send another one yet. */
  alreadySent?: boolean;
}

/** Shown where the dialog says "code sent to …" but the server did not say where. */
export const ALREADY_SENT_TARGET = "votre contact principal";

const SHARE_WINDOW_MS = 3000;
let pendingSend: Promise<string | null> | null = null;

/**
 * Sends the security code. Calls made within a few seconds share one request, so a dialog that
 * mounts twice (React Strict Mode) does not trigger the server's resend cooldown.
 * Resolves with where the code went, or `null` when one was already sent recently.
 */
function sendStepUpCode(): Promise<string | null> {
  if (!pendingSend) {
    pendingSend = auth.stepUp
      .request()
      .then((sent) => sent.target as string | null)
      .catch((error: unknown) => {
        // The code from the previous request is still valid: let the user type it.
        if (hasErrorCode(error, "OTP_COOLDOWN")) return null;
        throw error;
      });
    pendingSend.then(
      () => setTimeout(() => (pendingSend = null), SHARE_WINDOW_MS),
      () => (pendingSend = null),
    );
  }
  return pendingSend;
}

/** For dialogs that already know the user has no authenticator app. */
export async function requestStepUpTarget(): Promise<string> {
  return (await sendStepUpCode()) ?? ALREADY_SENT_TARGET;
}

/** Asks for a security code, or tells the dialog the authenticator app is the way. */
export async function loadStepUp(): Promise<StepUp> {
  const { enabled } = await account.twoFactor.status();
  if (enabled) return { authenticator: true, sentTo: null };
  const target = await sendStepUpCode();
  return target
    ? { authenticator: false, sentTo: target }
    : { authenticator: false, sentTo: null, alreadySent: true };
}
