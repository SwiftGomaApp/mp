import type { Auth } from "swiftgoma-mp-auth";
import type { DevicesApi } from "./devices-api";
import type { InboxApi } from "./inbox-api";

export type NotificationsAuth = Pick<Auth, "api" | "session" | "device">;

export type PushPermission = "granted" | "denied" | "undetermined";

export interface PushOpenEvent {
  notificationId: string | null;
  type: string | null;
}

export interface PushProvider {
  init(): Promise<void>;
  getPermission(): Promise<PushPermission>;
  requestPermission(): Promise<PushPermission>;
  getSubscriptionId(): Promise<string | null>;
  onSubscriptionChange(listener: (subscriptionId: string | null) => void): () => void;
  onOpen(listener: (event: PushOpenEvent) => void): () => void;
  identify(userId: string): Promise<void>;
  forget(): Promise<void>;
}

export type PushStatus =
  "disabled" | "idle" | "unavailable" | "permission-needed" | "denied" | "enabled";

export interface PushState {
  status: PushStatus;
  subscriptionId: string | null;
  registered: boolean;
}

export interface PushController {
  getState(): PushState;
  subscribe(listener: (state: PushState) => void): () => void;
  enable(): Promise<PushState>;
  disable(): Promise<PushState>;
  requestPermission(): Promise<PushState>;
  refresh(): Promise<PushState>;
  unregister(): Promise<void>;
  onOpen(listener: (event: PushOpenEvent) => void): () => void;
}

export interface PushControllerOptions {
  auth: NotificationsAuth;
  devices: DevicesApi;
  inbox: InboxApi;
  provider?: PushProvider | undefined;
  enabled?: boolean | undefined;
  onError?: ((error: unknown) => void) | undefined;
}

export interface PushRuntime extends PushController {
  start(): void;
  stop(): void;
}

export function createPushController(options: PushControllerOptions): PushRuntime {
  const { auth, devices, inbox, provider } = options;
  const report = (error: unknown): void => options.onError?.(error);

  let wanted = options.enabled ?? true;
  let state: PushState = {
    status: provider && wanted ? "idle" : "disabled",
    subscriptionId: null,
    registered: false,
  };
  const stateListeners = new Set<(state: PushState) => void>();
  const openListeners = new Set<(event: PushOpenEvent) => void>();

  let queue: Promise<unknown> = Promise.resolve();
  let initialised: Promise<void> | null = null;
  let providerStops: Array<() => void> = [];
  let registeredKey: string | null = null;
  let stopSession: (() => void) | null = null;
  let lastSessionKey: string | null = null;

  function set(patch: Partial<PushState>): void {
    state = { ...state, ...patch };
    for (const listener of [...stateListeners]) listener(state);
  }

  function serial<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task);
    queue = run.catch(() => undefined);
    return run;
  }

  function handleOpen(event: PushOpenEvent): void {
    if (event.notificationId && auth.session.getState().status === "authenticated") {
      inbox.markOpened(event.notificationId).catch(report);
    }
    for (const listener of [...openListeners]) listener(event);
  }

  function ensureInit(): Promise<void> {
    if (!provider) return Promise.resolve();
    initialised ??= provider
      .init()
      .then(() => {
        providerStops.push(
          provider.onSubscriptionChange(() => {
            void refresh();
          }),
          provider.onOpen(handleOpen),
        );
      })
      .catch((error: unknown) => {
        initialised = null;
        throw error;
      });
    return initialised;
  }

  async function forgetLocal(): Promise<void> {
    registeredKey = null;
    set({ subscriptionId: null, registered: false });
    if (provider && initialised) await provider.forget().catch(report);
  }

  async function syncNow(): Promise<PushState> {
    if (!provider || !wanted) {
      set({ status: "disabled" });
      return state;
    }

    const session = auth.session.getState();
    const userId = session.user?.id;
    if (session.status !== "authenticated" || !userId) {
      await forgetLocal();
      set({ status: "idle" });
      return state;
    }

    try {
      await ensureInit();
    } catch (error) {
      report(error);
      set({ status: "unavailable", subscriptionId: null, registered: false });
      return state;
    }

    try {
      const permission = await provider.getPermission();
      if (permission !== "granted") {
        set({
          status: permission === "denied" ? "denied" : "permission-needed",
          subscriptionId: null,
          registered: false,
        });
        return state;
      }

      await provider.identify(userId);
      const subscriptionId = await provider.getSubscriptionId();
      if (!subscriptionId) {
        set({ status: "enabled", subscriptionId: null, registered: false });
        return state;
      }

      const key = `${userId}:${subscriptionId}`;
      if (key !== registeredKey) {
        const { deviceId, platform } = await auth.device.get();
        await devices.register({ subscriptionId, deviceId, platform });
        registeredKey = key;
      }
      set({ status: "enabled", subscriptionId, registered: true });
    } catch (error) {
      report(error);
      set({ registered: false });
    }
    return state;
  }

  function refresh(): Promise<PushState> {
    return serial(syncNow);
  }

  async function removeNow(): Promise<void> {
    if (state.registered && state.subscriptionId) {
      await devices.remove(state.subscriptionId).catch(report);
    }
    await forgetLocal();
  }

  return {
    getState: () => state,

    subscribe(listener): () => void {
      stateListeners.add(listener);
      return () => stateListeners.delete(listener);
    },

    enable(): Promise<PushState> {
      wanted = true;
      return refresh();
    },

    disable(): Promise<PushState> {
      wanted = false;
      return serial(async () => {
        await removeNow();
        set({ status: "disabled" });
        return state;
      });
    },

    requestPermission(): Promise<PushState> {
      return serial(async () => {
        if (!provider || !wanted) return state;
        try {
          await ensureInit();
          await provider.requestPermission();
        } catch (error) {
          report(error);
          set({ status: "unavailable" });
          return state;
        }
        return syncNow();
      });
    },

    refresh,

    unregister(): Promise<void> {
      return serial(async () => {
        await removeNow();
        set({ status: provider && wanted ? "idle" : "disabled" });
      });
    },

    onOpen(listener): () => void {
      openListeners.add(listener);
      return () => openListeners.delete(listener);
    },

    start(): void {
      if (!provider || stopSession) return;
      stopSession = auth.session.subscribe((session) => {
        const key = `${session.status}:${session.user?.id ?? ""}`;
        if (key === lastSessionKey) return;
        lastSessionKey = key;
        void refresh();
      });
      void refresh();
    },

    stop(): void {
      stopSession?.();
      stopSession = null;
      lastSessionKey = null;
      for (const stop of providerStops) stop();
      providerStops = [];
      initialised = null;
    },
  };
}
