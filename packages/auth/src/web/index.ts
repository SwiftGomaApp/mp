export { PACKAGE_NAME } from "../core/index";
export { createWebAdapter } from "./adapter";
export { AUTH_COOKIE_NAMES, forwardAuthHeaders } from "./server";
export type {
  DocumentLike,
  LockManagerLike,
  StorageLike,
  WebAdapterOptions,
  WebEnvironment,
} from "./adapter";
export type { ForwardAuthOptions } from "./server";

export const PLATFORM = "web" as const;
