export { PACKAGE_NAME } from "../core/index";
export { createNativeAdapter } from "../core/adapter";
export type {
  AppStateLike,
  NativeAdapterOptions,
  SecureStoreLike,
  SecureStoreLikeOptions,
} from "../core/adapter";

export const PLATFORM = "native" as const;
