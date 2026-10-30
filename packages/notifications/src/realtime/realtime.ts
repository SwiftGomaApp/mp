import { io } from "socket.io-client";
import { API_PREFIX } from "swiftgoma-mp-auth";
import { isRecord } from "../core/answers";
import { SOCKET_EVENTS, SOCKET_FATAL_ERROR_CODES, SOCKET_PATH } from "../core/constants";
import type { InboxStore } from "../core/inbox-store";
import type { NotificationsAuth } from "../core/push";
import { parseDeleted, parseNew, parseRead } from "./payloads";

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

export type RealtimeStatus = "idle" | "connecting" | "connected" | "disconnected" | "stopped";

export interface RealtimeState {
  status: RealtimeStatus;
  /** The server's reason when `status` is `stopped`, for example `SESSION_REVOKED`. */
  error: string | null;
}

export interface Realtime {
  getState(): RealtimeState;
  subscribe(listener: (state: RealtimeState) => void): () => void;
  /** Connects while somebody is signed in and follows the session. Call it once. */
  start(): void;
  stop(): void;
  /** Connects again now, for example when the app returns to the foreground. */
  reconnect(): void;
}

export interface SocketLike {
  readonly connected: boolean;
  on(event: string, handler: (...args: any[]) => void): unknown;
  emit(event: string, ...args: unknown[]): unknown;
  disconnect(): unknown;
}

export interface SocketConnectOptions {
  path: string;
  transports: Array<"websocket" | "polling">;
  reconnection: false;
  withCredentials: boolean;
  auth?: (done: (data: { token: string }) => void) => void;
}

export type SocketFactory = (url: string, options: SocketConnectOptions) => SocketLike;

export interface RealtimeOptions {
  auth: NotificationsAuth;
  store: Pick<InboxStore, "applyNew" | "applyRead" | "applyDeleted" | "refresh" | "getState">;
  /** The API origin. Taken from the auth client when left out. */
  url?: string;
  socketFactory?: SocketFactory;
  onError?: (error: unknown) => void;
}

const defaultSocketFactory: SocketFactory = (url, options) =>
  io(url, options) as unknown as SocketLike;

function resolveOrigin(auth: NotificationsAuth, url: string | undefined): string {
  const base = (url ?? auth.api.defaults.baseURL ?? "").trim().replace(/\/+$/, "");
  const origin = base.endsWith(API_PREFIX) ? base.slice(0, -API_PREFIX.length) : base;
  if (!origin) throw new TypeError("swiftgoma-mp-notifications: the API address is unknown");
  return origin;
}

function readErrorCode(error: unknown): string {
  const data = isRecord(error) ? error.data : undefined;
  return isRecord(data) && typeof data.code === "string" ? data.code : "UNAVAILABLE";
}

function isFatal(code: string): boolean {
  return (SOCKET_FATAL_ERROR_CODES as readonly string[]).includes(code);
}

export function createRealtime(options: RealtimeOptions): Realtime {
  const { auth, store } = options;
  const origin = resolveOrigin(auth, options.url);
  const connect = options.socketFactory ?? defaultSocketFactory;
  const report = (error: unknown): void => options.onError?.(error);

  let state: RealtimeState = { status: "idle", error: null };
  const listeners = new Set<(state: RealtimeState) => void>();
  let socket: SocketLike | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopSession: (() => void) | null = null;
  let userId: string | null = null;
  let attempts = 0;
  let expired = false;
  /** Bumped whenever a connection in progress must be forgotten. */
  let epoch = 0;

  function set(next: RealtimeState): void {
    state = next;
    for (const listener of [...listeners]) listener(state);
  }

  function closeSocket(): void {
    epoch += 1;
    if (timer) clearTimeout(timer);
    timer = null;
    const previous = socket;
    socket = null;
    previous?.disconnect();
  }

  function backoff(): number {
    const ceiling = Math.min(RECONNECT_BASE_MS * 2 ** attempts, RECONNECT_MAX_MS);
    attempts += 1;
    return ceiling * (0.5 + Math.random() / 2);
  }

  function schedule(): void {
    closeSocket();
    set({ status: "disconnected", error: null });
    timer = setTimeout(() => {
      timer = null;
      launch();
    }, backoff());
  }

  function stopWith(code: string): void {
    closeSocket();
    set({ status: "stopped", error: code });
  }

  function launch(): void {
    open().catch((error: unknown) => {
      report(error);
      schedule();
    });
  }

  async function recoverToken(): Promise<void> {
    const mine = epoch;
    try {
      await auth.session.refreshNow();
    } catch (error) {
      report(error);
    }
    if (mine === epoch) schedule();
  }

  function handleError(code: string): void {
    if (isFatal(code)) stopWith(code);
    else if (code === "TOKEN_EXPIRED" || code === "UNAUTHORIZED") void recoverToken();
    else schedule();
  }

  function handleDisconnect(reason: string): void {
    if (reason === "io client disconnect") return;
    if (reason === "io server disconnect" && !expired) {
      set({ status: "disconnected", error: null });
      return;
    }
    schedule();
  }

  async function renew(target: SocketLike): Promise<void> {
    try {
      await auth.session.refreshNow();
      if (socket !== target) return;
      const token = await auth.session.getAccessToken();
      if (!token) {
        launch();
        return;
      }
      target.emit(SOCKET_EVENTS.authRefresh, { token }, (answer: unknown) => {
        const accepted = isRecord(answer) && answer.ok === true;
        if (!accepted && socket === target) launch();
      });
    } catch (error) {
      report(error);
    }
  }

  function bind(target: SocketLike): void {
    const current = (): boolean => socket === target;

    target.on("connect", () => {
      if (!current()) return;
      attempts = 0;
      expired = false;
      set({ status: "connected", error: null });
      if (store.getState().status !== "idle") void store.refresh();
    });
    target.on("connect_error", (error: unknown) => {
      if (current()) handleError(readErrorCode(error));
    });
    target.on("disconnect", (reason: string) => {
      if (current()) handleDisconnect(reason);
    });
    target.on(SOCKET_EVENTS.authExpiring, () => {
      if (current()) void renew(target);
    });
    target.on(SOCKET_EVENTS.authExpired, () => {
      if (current()) expired = true;
    });
    target.on(SOCKET_EVENTS.notificationNew, (payload: unknown) => {
      const event = parseNew(payload);
      if (event && current()) store.applyNew(event);
    });
    target.on(SOCKET_EVENTS.notificationRead, (payload: unknown) => {
      const event = parseRead(payload);
      if (event && current()) store.applyRead(event);
    });
    target.on(SOCKET_EVENTS.notificationDeleted, (payload: unknown) => {
      const event = parseDeleted(payload);
      if (event && current()) store.applyDeleted(event);
    });
  }

  async function open(): Promise<void> {
    if (!userId) return;
    closeSocket();
    const mine = epoch;
    set({ status: "connecting", error: null });

    const { platform } = await auth.device.get();
    if (mine !== epoch) return;

    const withCookies = platform === "WEB";
    socket = connect(origin, {
      path: SOCKET_PATH,
      transports: ["websocket", "polling"],
      reconnection: false,
      withCredentials: withCookies,
      ...(withCookies
        ? {}
        : {
            auth: (done) => {
              auth.session.getAccessToken().then(
                (token) => done({ token: token ?? "" }),
                () => done({ token: "" }),
              );
            },
          }),
    });
    bind(socket);
  }

  function followSession(): void {
    const session = auth.session.getState();
    if (session.status === "unknown") return;
    const next = session.status === "authenticated" ? (session.user?.id ?? null) : null;
    if (next === userId) return;

    userId = next;
    if (next) {
      attempts = 0;
      launch();
    } else {
      closeSocket();
      set({ status: "idle", error: null });
    }
  }

  return {
    getState: () => state,

    subscribe(listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    start(): void {
      if (stopSession) return;
      stopSession = auth.session.subscribe(followSession);
      followSession();
    },

    stop(): void {
      stopSession?.();
      stopSession = null;
      userId = null;
      closeSocket();
      set({ status: "idle", error: null });
    },

    reconnect(): void {
      if (!userId || state.status === "connected" || state.status === "connecting") return;
      attempts = 0;
      launch();
    },
  };
}
