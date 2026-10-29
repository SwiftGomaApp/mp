import type { AuthAdapter } from "../core/adapter";

const LOCK_NAME = "swiftgoma-mp-auth.refresh";
const CHANNEL_NAME = "swiftgoma-mp-auth";

/** The part of the Web Locks API that this package uses. */
export interface LocksLike {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

/** The part of `BroadcastChannel` that this package uses. */
export interface ChannelLike {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
  removeEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
  close(): void;
}

export interface TabEnvironment {
  locks?: LocksLike;
  createChannel?: (name: string) => ChannelLike;
}

function browserEnvironment(): TabEnvironment {
  return {
    locks: globalThis.navigator?.locks as LocksLike | undefined,
    createChannel:
      typeof BroadcastChannel === "undefined"
        ? undefined
        : (name) => new BroadcastChannel(name) as unknown as ChannelLike,
  };
}

function readExpiresIn(data: unknown): number | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const { type, expiresInSeconds } = data as Record<string, unknown>;
  return type === "refreshed" &&
    typeof expiresInSeconds === "number" &&
    Number.isFinite(expiresInSeconds) &&
    expiresInSeconds > 0
    ? expiresInSeconds
    : undefined;
}

/**
 * Lets the tabs of one browser take turns refreshing the session. Without the Web Locks API or
 * `BroadcastChannel`, a tab simply refreshes on its own, as before.
 */
export function createTabCoordination(
  environment: TabEnvironment = browserEnvironment(),
): Pick<AuthAdapter, "withRefreshLock" | "announceRefresh" | "onRefreshedElsewhere"> {
  let channel: ChannelLike | null = null;
  const openChannel = (): ChannelLike | null => {
    channel ??= environment.createChannel?.(CHANNEL_NAME) ?? null;
    return channel;
  };

  return {
    withRefreshLock: (run) =>
      environment.locks ? environment.locks.request(LOCK_NAME, run) : run(),

    announceRefresh(expiresInSeconds): void {
      openChannel()?.postMessage({ type: "refreshed", expiresInSeconds });
    },

    onRefreshedElsewhere(listener): () => void {
      const source = openChannel();
      if (!source) return () => undefined;

      const onMessage = (event: { data: unknown }): void => {
        const expiresInSeconds = readExpiresIn(event.data);
        if (expiresInSeconds !== undefined) listener(expiresInSeconds);
      };
      source.addEventListener("message", onMessage);
      return () => {
        source.removeEventListener("message", onMessage);
        source.close();
        if (channel === source) channel = null;
      };
    },
  };
}
