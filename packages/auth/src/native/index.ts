export { PACKAGE_NAME } from "../core/index";
export { createNativeAdapter } from "./adapter";
export type {
  AppStateLike,
  NativeAdapterOptions,
  SecureStoreLike,
  SecureStoreLikeOptions,
} from "./adapter";

export const PLATFORM = "native" as const;
