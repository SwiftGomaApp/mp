import { account } from "@/lib/account";
import { auth } from "@/lib/auth";

export interface StepUp {
  authenticator: boolean;
  sentTo: string | null;
}

export async function loadStepUp(): Promise<StepUp> {
  const { enabled } = await account.twoFactor.status();
  if (enabled) return { authenticator: true, sentTo: null };
  const sent = await auth.stepUp.request();
  return { authenticator: false, sentTo: sent.target };
}
