import type { AxiosInstance, AxiosRequestConfig } from "axios";
import { createHttpClient } from "../../core/client";
import { isApiError } from "../../core/errors";
import type { CurrentUser } from "../../core/types";

export interface ServerClientOptions {
  /** The API origin, for example `https://app.swiftgoma.com`. `/api/v1` is added for you. */
  baseUrl: string;
  /**
   * The visitor's `Cookie` header, as the page received it. In Next.js (App Router):
   * `(await headers()).get("cookie")`.
   */
  cookie: string | null | undefined;
  /** The origin of the web app, for requests the server only accepts from a known origin. */
  origin?: string;
  timeoutMs?: number;
  /** Replaces the way requests are sent. For tests. */
  transport?: AxiosRequestConfig["adapter"];
}

/**
 * An Axios client for server rendering: it calls the API as the visitor by forwarding their
 * cookies. It cannot renew an expired session, because a server-rendered page cannot set
 * cookies for the browser; the browser-side client does that.
 */
export function createServerClient(options: ServerClientOptions): AxiosInstance {
  const headers: Record<string, string> = {};
  if (options.cookie) headers.Cookie = options.cookie;
  if (options.origin) headers.Origin = options.origin;

  return createHttpClient({
    baseUrl: options.baseUrl,
    timeoutMs: options.timeoutMs,
    headers,
    adapter: options.transport,
  });
}

/**
 * The visitor's account, or `null` if they are not signed in (or their access cookie has
 * expired). Other failures, such as a server error, are thrown.
 */
export async function fetchCurrentUser(client: AxiosInstance): Promise<CurrentUser | null> {
  try {
    const response = await client.get<{ user?: CurrentUser }>("/auth/me");
    return response.data.user ?? null;
  } catch (error) {
    if (isApiError(error) && error.status === 401) return null;
    throw error;
  }
}
