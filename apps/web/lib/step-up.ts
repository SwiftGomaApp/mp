import { account } from "@/lib/account";
import { auth } from "@/lib/auth";

export interface StepUp {
  /** True when the code to give is the one from the authenticator app. */
  authenticator: boolean;
  /** Where the code was sent, when it was sent. */
  sentTo: string | null;
}

/** With two-step verification on, the app code is the step-up code; otherwise one is sent. */
export async function loadStepUp(): Promise<StepUp> {
  const { enabled } = await account.twoFactor.status();
  if (enabled) return { authenticator: true, sentTo: null };
  const sent = await auth.stepUp.request();
  return { authenticator: false, sentTo: sent.target };
}
