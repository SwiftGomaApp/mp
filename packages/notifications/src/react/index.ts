import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactElement, ReactNode } from "react";
import type { Notifications } from "../core/create-notifications";
import type { InboxState, InboxStore } from "../core/inbox-store";
import type { PushController, PushOpenEvent, PushState } from "../core/push";
import type { PreferenceChange, Preferences, SettingsPatch, UnreadSummary } from "../core/types";
import type { Realtime, RealtimeState } from "../realtime/realtime";

interface ContextValue {
  notifications: Notifications;
  realtime: Realtime | null;
}

const NotificationsContext = createContext<ContextValue | null>(null);

const IDLE_REALTIME: RealtimeState = { status: "idle", error: null };
const noSubscription = (): (() => void) => () => {};

export interface NotificationsProviderProps {
  /** The object from `createNotifications`. Create it once, outside any component. */
  notifications: Notifications;
  /** The object from `createRealtime`, to keep the inbox live. */
  realtime?: Realtime;
  children?: ReactNode;
}

/**
 * Starts the notifications (and the live connection) when the app mounts, and stops them when
 * it unmounts. In Next.js, use it from a client component.
 */
export function NotificationsProvider({
  notifications,
  realtime,
  children,
}: NotificationsProviderProps): ReactElement {
  useEffect(() => {
    notifications.start();
    realtime?.start();
    return () => {
      realtime?.stop();
      notifications.stop();
    };
  }, [notifications, realtime]);

  const value = useMemo(
    () => ({ notifications, realtime: realtime ?? null }),
    [notifications, realtime],
  );
  return createElement(NotificationsContext.Provider, { value }, children);
}

function useContextValue(): ContextValue {
  const value = useContext(NotificationsContext);
  if (!value) {
    throw new Error(
      "swiftgoma-mp-notifications: the hooks must be used inside <NotificationsProvider>",
    );
  }
  return value;
}

/** The `Notifications` object given to `NotificationsProvider`. */
export function useNotifications(): Notifications {
  return useContextValue().notifications;
}

export type InboxView = InboxState &
  Pick<
    InboxStore,
    "loadMore" | "refresh" | "setContext" | "markRead" | "acknowledge" | "markAllRead" | "remove"
  >;

export interface UseInboxOptions {
  /** Load the first page when the screen mounts. Defaults to true. */
  autoLoad?: boolean;
}

/** The inbox: items, counts and the actions on them. Re-renders on every change. */
export function useInbox(options: UseInboxOptions = {}): InboxView {
  const { store } = useNotifications();
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const requested = useRef(false);
  const autoLoad = options.autoLoad ?? true;

  useEffect(() => {
    if (!autoLoad || requested.current || state.status !== "idle") return;
    requested.current = true;
    void store.load();
  }, [autoLoad, state.status, store]);

  return useMemo(
    () => ({
      ...state,
      loadMore: store.loadMore,
      refresh: store.refresh,
      setContext: store.setContext,
      markRead: store.markRead,
      acknowledge: store.acknowledge,
      markAllRead: store.markAllRead,
      remove: store.remove,
    }),
    [state, store],
  );
}

/** The badge: how many notifications are unread. Fetched on its own if the inbox is not loaded. */
export function useUnreadCount(): number {
  const { store } = useNotifications();
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current || store.getState().status !== "idle") return;
    requested.current = true;
    void store.refreshSummary();
  }, [store]);

  return useSyncExternalStore(
    store.subscribe,
    () => store.getState().unreadCount,
    () => 0,
  );
}

/** How many are unread in each context. */
export function useUnreadByContext(): UnreadSummary["byContext"] {
  const { store } = useNotifications();
  return useSyncExternalStore(
    store.subscribe,
    () => store.getState().byContext,
    () => store.getState().byContext,
  );
}

export interface PreferencesView {
  status: "loading" | "ready" | "error";
  preferences: Preferences | null;
  error: unknown;
  reload(): Promise<void>;
  /** Rejects with the server's error, for example `PREFERENCE_LOCKED`. */
  update(changes: readonly PreferenceChange[]): Promise<void>;
  updateSettings(patch: SettingsPatch): Promise<void>;
}

interface PreferencesState {
  status: PreferencesView["status"];
  preferences: Preferences | null;
  error: unknown;
}

/** The notification preferences and settings of the signed-in person. */
export function usePreferences(): PreferencesView {
  const { preferences: api } = useNotifications();
  const [state, setState] = useState<PreferencesState>({
    status: "loading",
    preferences: null,
    error: null,
  });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async (): Promise<void> => {
    try {
      const preferences = await api.get();
      if (mounted.current) setState({ status: "ready", preferences, error: null });
    } catch (error) {
      if (mounted.current) setState((current) => ({ ...current, status: "error", error }));
    }
  }, [api]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const update = useCallback(
    async (changes: readonly PreferenceChange[]): Promise<void> => {
      const preferences = await api.update(changes);
      if (mounted.current) setState({ status: "ready", preferences, error: null });
    },
    [api],
  );

  const updateSettings = useCallback(
    async (patch: SettingsPatch): Promise<void> => {
      const settings = await api.updateSettings(patch);
      if (!mounted.current) return;
      setState((current) =>
        current.preferences
          ? { ...current, preferences: { ...current.preferences, settings } }
          : current,
      );
    },
    [api],
  );

  return useMemo(
    () => ({ ...state, reload, update, updateSettings }),
    [state, reload, update, updateSettings],
  );
}

export type PushView = PushState &
  Pick<PushController, "enable" | "disable" | "requestPermission" | "refresh">;

/** The push state, and what to do about it: ask the permission, switch it on or off. */
export function usePush(): PushView {
  const { push } = useNotifications();
  const state = useSyncExternalStore(push.subscribe, push.getState, push.getState);
  return useMemo(
    () => ({
      ...state,
      enable: push.enable,
      disable: push.disable,
      requestPermission: push.requestPermission,
      refresh: push.refresh,
    }),
    [state, push],
  );
}

/** Calls the listener when the person opens the app from a push. Use it to navigate. */
export function usePushOpen(listener: (event: PushOpenEvent) => void): void {
  const { push } = useNotifications();
  const latest = useRef(listener);

  useEffect(() => {
    latest.current = listener;
  }, [listener]);

  useEffect(() => push.onOpen((event) => latest.current(event)), [push]);
}

/** The state of the live connection. Always `idle` when no `realtime` was given. */
export function useRealtimeState(): RealtimeState {
  const { realtime } = useContextValue();
  return useSyncExternalStore(
    realtime ? realtime.subscribe : noSubscription,
    realtime ? realtime.getState : () => IDLE_REALTIME,
    () => IDLE_REALTIME,
  );
}
