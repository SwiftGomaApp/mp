import { createAuth } from "@swiftgoma/auth";
import { createNativeAdapter } from "@swiftgoma/auth/native";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";

import { requireApiOrigin } from "@/core/api/config";

const appVersion = Constants.expoConfig?.version ?? "0.0.0";

const devLogger = {
  debug: (message: string, meta?: unknown) => console.debug("[auth]", message, meta ?? ""),
  warn: (message: string, meta?: unknown) => console.warn("[auth]", message, meta ?? ""),
  error: (message: string, meta?: unknown) => console.error("[auth]", message, meta ?? ""),
};
const logger = __DEV__ ? devLogger : undefined;

export const auth = createAuth({
  baseUrl: requireApiOrigin(),
  logger,
  adapter: createNativeAdapter({
    secureStore: SecureStore,
    appState: AppState,
    os: Platform.OS,
    randomUUID: Crypto.randomUUID,
    deviceName: () => Device.modelName ?? Device.deviceName,
    userAgent: `SwiftGoma-Buyer/${appVersion} (${Platform.OS})`,
    logger,
  }),
});
