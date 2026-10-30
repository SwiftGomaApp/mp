import type { Context } from "./constants";
import type { InboxApi } from "./inbox-api";
import type {
  InboxQuery,
  NotificationDeletedEvent,
  NotificationItem,
  NotificationNewEvent,
  NotificationReadEvent,
  UnreadSummary,
} from "./types";

type ByContext = UnreadSummary["byContext"];

export type InboxStatus = "idle" | "loading" | "ready" | "error";

export interface InboxState {
  items: NotificationItem[];
  nextCursor: string | null;
  unreadCount: number;
  byContext: ByContext;
  status: InboxStatus;
  loadingMore: boolean;
  error: unknown;
  context: Context | null;
}

export interface InboxStore {
  getState(): InboxState;
  subscribe(listener: (state: InboxState) => void): () => void;
  load(): Promise<void>;
  refresh(): Promise<void>;
  loadMore(): Promise<void>;
  setContext(context: Context | null): Promise<void>;
  refreshSummary(): Promise<void>;
  markRead(id: string): Promise<void>;
  acknowledge(id: string): Promise<void>;
  markAllRead(context?: Context): Promise<void>;
  remove(id: string): Promise<void>;
  applyNew(event: NotificationNewEvent): void;
  applyRead(event: NotificationReadEvent): void;
  applyDeleted(event: NotificationDeletedEvent): void;
  reset(): void;
}

export interface InboxStoreOptions {
  inbox: InboxApi;
  pageSize?: number | undefined;
  now?: (() => number) | undefined;
  onError?: ((error: unknown) => void) | undefined;
}

function initialState(): InboxState {
  return {
    items: [],
    nextCursor: null,
    unreadCount: 0,
    byContext: {},
    status: "idle",
    loadingMore: false,
    error: null,
    context: null,
  };
}

function withoutContext(byContext: ByContext, context: Context): ByContext {
  const next = { ...byContext };
  delete next[context];
  return next;
}

function bump(byContext: ByContext, context: Context, delta: number): ByContext {
  const count = (byContext[context] ?? 0) + delta;
  const next = withoutContext(byContext, context);
  if (count > 0) next[context] = count;
  return next;
}

function patchItem(
  state: InboxState,
  id: string,
  change: (item: NotificationItem) => NotificationItem,
): Partial<InboxState> {
  const item = state.items.find((candidate) => candidate.id === id);
  if (!item) return {};
  const next = change(item);
  const becameRead = item.readAt === null && next.readAt !== null;
  return {
    items: state.items.map((candidate) => (candidate.id === id ? next : candidate)),
    ...(becameRead
      ? {
          unreadCount: Math.max(state.unreadCount - 1, 0),
          byContext: bump(state.byContext, item.context, -1),
        }
      : {}),
  };
}

function dropItem(state: InboxState, id: string): Partial<InboxState> {
  const item = state.items.find((candidate) => candidate.id === id);
  if (!item) return {};
  return {
    items: state.items.filter((candidate) => candidate.id !== id),
    ...(item.readAt === null
      ? {
          unreadCount: Math.max(state.unreadCount - 1, 0),
          byContext: bump(state.byContext, item.context, -1),
        }
      : {}),
  };
}

export function createInboxStore(options: InboxStoreOptions): InboxStore {
  const { inbox } = options;
  const clock = options.now ?? Date.now;
  const report = (error: unknown): void => options.onError?.(error);
  const stamp = (): string => new Date(clock()).toISOString();

  let state = initialState();
  const listeners = new Set<(state: InboxState) => void>();
  let generation = 0;
  let loading: Promise<void> | null = null;
  let summaryRun: Promise<void> | null = null;

  function notify(): void {
    for (const listener of [...listeners]) listener(state);
  }

  function set(patch: Partial<InboxState>): void {
    state = { ...state, ...patch };
    notify();
  }

  function query(cursor?: string): InboxQuery {
    return {
      ...(cursor ? { cursor } : {}),
      ...(options.pageSize !== undefined ? { limit: options.pageSize } : {}),
      ...(state.context ? { context: state.context } : {}),
    };
  }

  function load(): Promise<void> {
    if (loading) return loading;
    const mine = generation;
    set({ status: state.items.length ? state.status : "loading", error: null });

    const run = (async (): Promise<void> => {
      try {
        const [page, summary] = await Promise.all([inbox.list(query()), inbox.unreadCount()]);
        if (mine !== generation) return;
        set({
          items: page.items,
          nextCursor: page.nextCursor,
          unreadCount: summary.unreadCount,
          byContext: summary.byContext,
          status: "ready",
          loadingMore: false,
          error: null,
        });
      } catch (error) {
        if (mine !== generation) return;
        set({ status: state.items.length ? "ready" : "error", error });
        report(error);
      }
    })();

    loading = run;
    void run.then(() => {
      if (loading === run) loading = null;
    });
    return run;
  }

  async function loadMore(): Promise<void> {
    const { nextCursor, loadingMore, status } = state;
    if (!nextCursor || loadingMore || status !== "ready") return;
    const mine = generation;
    set({ loadingMore: true });
    try {
      const page = await inbox.list(query(nextCursor));
      if (mine !== generation) return;
      const known = new Set(state.items.map((item) => item.id));
      set({
        items: [...state.items, ...page.items.filter((item) => !known.has(item.id))],
        nextCursor: page.nextCursor,
        loadingMore: false,
      });
    } catch (error) {
      if (mine !== generation) return;
      set({ loadingMore: false, error });
      report(error);
    }
  }

  async function setContext(context: Context | null): Promise<void> {
    if (context === state.context) return;
    generation += 1;
    loading = null;
    set({ context, items: [], nextCursor: null, status: "idle", loadingMore: false, error: null });
    await load();
  }

  function refreshSummary(): Promise<void> {
    if (summaryRun) return summaryRun;
    const mine = generation;
    const run = inbox.unreadCount().then(
      (summary) => {
        if (mine === generation) {
          set({ unreadCount: summary.unreadCount, byContext: summary.byContext });
        }
      },
      (error: unknown) => report(error),
    );
    summaryRun = run;
    void run.then(() => {
      if (summaryRun === run) summaryRun = null;
    });
    return run;
  }

  async function mutate(
    optimistic: (current: InboxState) => Partial<InboxState>,
    call: () => Promise<{ unreadCount: number }>,
  ): Promise<void> {
    const before = state;
    const mine = generation;
    set(optimistic(state));
    try {
      const result = await call();
      if (mine === generation) set({ unreadCount: result.unreadCount });
    } catch (error) {
      if (mine === generation) {
        set({
          items: before.items,
          unreadCount: before.unreadCount,
          byContext: before.byContext,
        });
        void load();
      }
      throw error;
    }
  }

  function readLocally(current: InboxState, context: Context | undefined): Partial<InboxState> {
    const stamped = stamp();
    return {
      items: current.items.map((item) =>
        !item.readAt && (!context || item.context === context)
          ? { ...item, readAt: stamped }
          : item,
      ),
      unreadCount: context
        ? Math.max(current.unreadCount - (current.byContext[context] ?? 0), 0)
        : 0,
      byContext: context ? withoutContext(current.byContext, context) : {},
    };
  }

  return {
    getState: () => state,

    subscribe(listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    load,
    refresh: load,
    loadMore,
    setContext,
    refreshSummary,

    markRead: (id) =>
      mutate(
        (current) =>
          patchItem(current, id, (item) => (item.readAt ? item : { ...item, readAt: stamp() })),
        () => inbox.markRead(id),
      ),

    acknowledge: (id) =>
      mutate(
        (current) =>
          patchItem(current, id, (item) => ({
            ...item,
            readAt: item.readAt ?? stamp(),
            acknowledgedAt: item.acknowledgedAt ?? stamp(),
          })),
        () => inbox.acknowledge(id),
      ),

    markAllRead: (context) =>
      mutate(
        (current) => readLocally(current, context),
        () => inbox.markAllRead(context ? { context } : {}),
      ),

    remove: (id) =>
      mutate(
        (current) => dropItem(current, id),
        () => inbox.remove(id),
      ),

    applyNew({ notification, unreadCount }): void {
      if (state.items.some((item) => item.id === notification.id)) {
        set({ unreadCount });
        return;
      }
      const shown =
        state.status === "ready" && (!state.context || notification.context === state.context);
      set({
        unreadCount,
        byContext: notification.readAt
          ? state.byContext
          : bump(state.byContext, notification.context, 1),
        ...(shown ? { items: [notification, ...state.items] } : {}),
      });
    },

    applyRead(event): void {
      if (event.all) {
        const context = event.context ?? undefined;
        set({ ...readLocally(state, context), unreadCount: event.unreadCount });
        return;
      }

      const stamped = stamp();
      let current = state;
      let unknown = false;
      for (const id of event.ids ?? []) {
        if (!current.items.some((item) => item.id === id)) {
          unknown = true;
          continue;
        }
        current = {
          ...current,
          ...patchItem(current, id, (item) => (item.readAt ? item : { ...item, readAt: stamped })),
        };
      }
      set({ items: current.items, byContext: current.byContext, unreadCount: event.unreadCount });
      if (unknown) void refreshSummary();
    },

    applyDeleted(event): void {
      let current = state;
      let unknown = false;
      for (const id of event.ids) {
        if (!current.items.some((item) => item.id === id)) {
          unknown = true;
          continue;
        }
        current = { ...current, ...dropItem(current, id) };
      }
      set({ items: current.items, byContext: current.byContext, unreadCount: event.unreadCount });
      if (unknown) void refreshSummary();
    },

    reset(): void {
      generation += 1;
      loading = null;
      summaryRun = null;
      state = initialState();
      notify();
    },
  };
}
