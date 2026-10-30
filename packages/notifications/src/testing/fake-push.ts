import type { PushOpenEvent, PushPermission, PushProvider } from "../core/push";

export interface FakePushProvider extends PushProvider {
  permission: PushPermission;
  subscriptionId: string | null;
  /** Makes `init()` fail, as it does in Expo Go. */
  initError: Error | null;
  /** The user the install is tied to, or null. */
  readonly identifiedUser: string | null;
  changeSubscription(id: string | null): void;
  /** Simulates a tap on a push. */
  tap(event: PushOpenEvent): void;
}

export interface FakePushProviderOptions {
  permission?: PushPermission;
  subscriptionId?: string | null;
}

export function createFakePushProvider(options: FakePushProviderOptions = {}): FakePushProvider {
  const changes = new Set<(id: string | null) => void>();
  const taps = new Set<(event: PushOpenEvent) => void>();
  let identifiedUser: string | null = null;

  const provider: FakePushProvider = {
    permission: options.permission ?? "granted",
    subscriptionId:
      options.subscriptionId === undefined ? "fake-subscription-1" : options.subscriptionId,
    initError: null,

    get identifiedUser(): string | null {
      return identifiedUser;
    },

    async init(): Promise<void> {
      if (provider.initError) throw provider.initError;
    },

    getPermission: async () => provider.permission,

    async requestPermission(): Promise<PushPermission> {
      if (provider.permission === "undetermined") provider.permission = "granted";
      return provider.permission;
    },

    getSubscriptionId: async () => provider.subscriptionId,

    onSubscriptionChange(listener): () => void {
      changes.add(listener);
      return () => changes.delete(listener);
    },

    onOpen(listener): () => void {
      taps.add(listener);
      return () => taps.delete(listener);
    },

    async identify(userId: string): Promise<void> {
      identifiedUser = userId;
    },

    async forget(): Promise<void> {
      identifiedUser = null;
    },

    changeSubscription(id): void {
      provider.subscriptionId = id;
      for (const listener of [...changes]) listener(id);
    },

    tap(event): void {
      for (const listener of [...taps]) listener(event);
    },
  };
  return provider;
}
