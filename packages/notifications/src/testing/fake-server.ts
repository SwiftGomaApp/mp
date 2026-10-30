import { AxiosError, AxiosHeaders } from "axios";
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import type { Role } from "swiftgoma-mp-auth";
import type { Context } from "../core/constants";
import { EVENT_CATALOG, EVENT_TYPES } from "../core/events";
import type { EventType } from "../core/events";
import type {
  CatalogEntry,
  DeviceRegistrationInput,
  NotificationItem,
  PreferenceChange,
  Preferences,
  SettingsPatch,
  UnreadSummary,
} from "../core/types";

const PAGE_SIZE_DEFAULT = 20;

export interface FakeRequest {
  method: string;
  /** Relative to the API prefix, for example `/notifications/unread-count`. */
  path: string;
  body: unknown;
}

export interface FakeNotificationInput {
  type?: EventType | (string & {});
  context?: Context;
  title?: string;
  body?: string;
  data?: Record<string, unknown> | null;
  read?: boolean;
}

export interface FakeNotificationsServerOptions {
  /** Decides which events the catalog lists. Defaults to `BUYER`. */
  role?: Role;
  now?: () => number;
}

export interface FakeNotificationsServer {
  /** Give it to `createHttpClient({ adapter })`, or route to it with `combineTransports`. */
  transport: AxiosAdapter;
  readonly requests: readonly FakeRequest[];
  readonly devices: readonly DeviceRegistrationInput[];
  /** What `GET /notifications/preferences` answers. Replace it to test another screen. */
  preferences: Preferences;
  /** Puts a notification in the inbox, as the server does when something happens. */
  add(input?: FakeNotificationInput): NotificationItem;
  /** While offline, every request fails like a lost connection. */
  setOffline(offline: boolean): void;
}

interface Reply {
  status: number;
  data?: unknown;
}

type Handler = (match: RegExpMatchArray, request: FakeRequest, params: URLSearchParams) => Reply;

function failure(status: number, code: string, message: string): Reply {
  return { status, data: { error: { code, message, requestId: "fake" } } };
}

const notFound = (): Reply => failure(404, "NOTIFICATION_NOT_FOUND", "Notification introuvable");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function createFakeNotificationsServer(
  options: FakeNotificationsServerOptions = {},
): FakeNotificationsServer {
  const role = options.role ?? "BUYER";
  const clock = options.now ?? Date.now;
  const requests: FakeRequest[] = [];
  const devices: DeviceRegistrationInput[] = [];
  const opened = new Set<string>();
  let items: NotificationItem[] = [];
  let created = 0;
  let offline = false;

  const now = (): string => new Date(clock()).toISOString();
  const unread = (): NotificationItem[] => items.filter((item) => !item.readAt);
  const find = (id: string | undefined): NotificationItem | undefined =>
    items.find((item) => item.id === id);
  const update = (id: string, patch: Partial<NotificationItem>): void => {
    items = items.map((item) => (item.id === id ? { ...item, ...patch } : item));
  };

  function summary(): UnreadSummary {
    const byContext: UnreadSummary["byContext"] = {};
    for (const item of unread()) byContext[item.context] = (byContext[item.context] ?? 0) + 1;
    return { unreadCount: unread().length, byContext };
  }

  const server: FakeNotificationsServer = {
    transport: (config) => respond(config),
    requests,
    devices,
    preferences: {
      categories: [],
      settings: {
        timezone: "Africa/Lubumbashi",
        quietHoursEnabled: false,
        quietHoursStart: null,
        quietHoursEnd: null,
        marketingEmailOptIn: false,
      },
    },

    add(input = {}): NotificationItem {
      created += 1;
      const type = input.type ?? "order.placed";
      const info = EVENT_TYPES.includes(type as EventType)
        ? EVENT_CATALOG[type as EventType]
        : undefined;
      const createdAt = new Date(clock() + created).toISOString();
      const item: NotificationItem = {
        id: `fake-notification-${created}`,
        type,
        context: input.context ?? info?.context ?? "ANNOUNCEMENT",
        priority: info?.priority ?? "NORMAL",
        title: input.title ?? type,
        body: input.body ?? "",
        data: input.data ?? null,
        readAt: input.read ? createdAt : null,
        acknowledgedAt: null,
        createdAt,
      };
      items = [item, ...items];
      return item;
    },

    setOffline(value): void {
      offline = value;
    },
  };

  const list: Handler = (_match, _request, params) => {
    const offset = Number(params.get("cursor") ?? 0);
    if (!Number.isInteger(offset) || offset < 0) {
      return failure(400, "INVALID_CURSOR", "Curseur invalide");
    }
    const limit = Number(params.get("limit") ?? PAGE_SIZE_DEFAULT);
    const context = params.get("context");
    const onlyUnread = params.get("unread") === "true";

    const matching = items.filter(
      (item) => (!context || item.context === context) && (!onlyUnread || !item.readAt),
    );
    const page = matching.slice(offset, offset + limit);
    const end = offset + page.length;
    return {
      status: 200,
      data: {
        items: page,
        nextCursor: end < matching.length ? String(end) : null,
        unreadCount: unread().length,
      },
    };
  };

  const catalog: Handler = () => {
    const events: CatalogEntry[] = EVENT_TYPES.filter((type) => {
      const { roles } = EVENT_CATALOG[type];
      return !roles || roles.includes(role);
    }).map((type) => {
      const { context, priority, mandatory, channels, escalation } = EVENT_CATALOG[type];
      return { type, context, priority, mandatory, channels: [...channels], escalation };
    });
    return { status: 200, data: { events } };
  };

  const updatePreferences: Handler = (_match, request) => {
    const changes = (isRecord(request.body) ? request.body.preferences : []) as PreferenceChange[];
    for (const { context, channel, enabled } of changes) {
      const category = server.preferences.categories.find((entry) => entry.context === context);
      const state = category?.channels.find((entry) => entry.channel === channel);
      if (!category || !state) {
        return failure(
          400,
          "PREFERENCE_UNAVAILABLE",
          "Cette catégorie ou ce canal n'est pas disponible",
        );
      }
      if (category.locked || state.locked) {
        return failure(
          403,
          "PREFERENCE_LOCKED",
          "Ces notifications ne peuvent pas être désactivées",
        );
      }
      state.enabled = enabled;
    }
    return { status: 200, data: server.preferences };
  };

  const updateSettings: Handler = (_match, request) => {
    const settings = { ...server.preferences.settings, ...(request.body as SettingsPatch) };
    server.preferences = { ...server.preferences, settings };
    return { status: 200, data: settings };
  };

  const registerDevice: Handler = (_match, request) => {
    devices.push(request.body as DeviceRegistrationInput);
    return { status: 201, data: { id: `fake-device-${devices.length}` } };
  };

  const removeDevice: Handler = (match) => {
    const subscriptionId = decodeURIComponent(match[1] ?? "");
    const kept = devices.filter((device) => device.subscriptionId !== subscriptionId);
    const removed = devices.length - kept.length;
    devices.splice(0, devices.length, ...kept);
    return { status: 200, data: { removed } };
  };

  const readAll: Handler = (_match, request) => {
    const context = isRecord(request.body) ? request.body.context : undefined;
    const targets = unread().filter((item) => !context || item.context === context);
    const readAt = now();
    items = items.map((item) => (targets.includes(item) ? { ...item, readAt } : item));
    return { status: 200, data: { updated: targets.length, unreadCount: unread().length } };
  };

  const read: Handler = (match) => {
    const item = find(match[1]);
    if (!item) return notFound();
    const readAt = item.readAt ?? now();
    update(item.id, { readAt });
    return { status: 200, data: { id: item.id, readAt, unreadCount: unread().length } };
  };

  const acknowledge: Handler = (match) => {
    const item = find(match[1]);
    if (!item) return notFound();
    const acknowledgedAt = item.acknowledgedAt ?? now();
    update(item.id, { readAt: item.readAt ?? acknowledgedAt, acknowledgedAt });
    return {
      status: 200,
      data: { id: item.id, acknowledgedAt, unreadCount: unread().length },
    };
  };

  const open: Handler = (match) => {
    const item = find(match[1]);
    if (!item) return notFound();
    const recorded = !opened.has(item.id);
    opened.add(item.id);
    return { status: 200, data: { id: item.id, recorded } };
  };

  const remove: Handler = (match) => {
    const item = find(match[1]);
    if (!item) return notFound();
    items = items.filter((candidate) => candidate.id !== item.id);
    return { status: 200, data: { id: item.id, unreadCount: unread().length } };
  };

  const routes: Array<[string, RegExp, Handler]> = [
    ["GET", /^$/, list],
    ["GET", /^\/unread-count$/, () => ({ status: 200, data: summary() })],
    ["GET", /^\/catalog$/, catalog],
    ["GET", /^\/preferences$/, () => ({ status: 200, data: server.preferences })],
    ["PATCH", /^\/preferences$/, updatePreferences],
    ["PATCH", /^\/settings$/, updateSettings],
    ["POST", /^\/devices$/, registerDevice],
    ["DELETE", /^\/devices\/([^/]+)$/, removeDevice],
    ["POST", /^\/read-all$/, readAll],
    ["PATCH", /^\/([^/]+)\/read$/, read],
    ["POST", /^\/([^/]+)\/ack$/, acknowledge],
    ["POST", /^\/([^/]+)\/opened$/, open],
    ["DELETE", /^\/([^/]+)$/, remove],
  ];

  function route(request: FakeRequest, params: URLSearchParams): Reply {
    const path = request.path.replace(/^\/notifications/, "");
    for (const [method, pattern, handler] of routes) {
      const match = method === request.method ? path.match(pattern) : null;
      if (match) return handler(match, request, params);
    }
    return failure(404, "NOT_FOUND", "Route introuvable");
  }

  function respond(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
    if (offline) return Promise.reject(new AxiosError("offline", "ERR_NETWORK", config));

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(config.params ?? {})) {
      if (value !== undefined) params.set(key, String(value));
    }
    const request: FakeRequest = {
      method: String(config.method).toUpperCase(),
      path: String(config.url),
      body: typeof config.data === "string" ? JSON.parse(config.data) : config.data,
    };
    requests.push(request);

    const reply = route(request, params);
    const response: AxiosResponse = {
      status: reply.status,
      statusText: "",
      data: reply.data ?? {},
      headers: new AxiosHeaders(),
      config,
    };
    return reply.status >= 400
      ? Promise.reject(new AxiosError("failed", "ERR_BAD_RESPONSE", config, null, response))
      : Promise.resolve(response);
  }

  return server;
}

/** Sends each request to the fake server whose prefix its path starts with. */
export function combineTransports(routes: Record<string, AxiosAdapter>): AxiosAdapter {
  return (config) => {
    const url = String(config.url);
    const prefix = Object.keys(routes).find((candidate) => url.startsWith(candidate));
    const adapter = prefix ? routes[prefix] : undefined;
    return adapter
      ? adapter(config)
      : Promise.reject(new AxiosError(`No fake server for ${url}`, "ERR_NETWORK", config));
  };
}
