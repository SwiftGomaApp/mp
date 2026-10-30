import type { AxiosInstance } from "axios";
import { PLATFORMS } from "swiftgoma-mp-auth";
import { expectRecord, readNumber, readString } from "./answers";
import {
  DEVICE_ID_MAX_LENGTH,
  DEVICE_ID_MIN_LENGTH,
  NOTIFICATIONS_PATH,
  SUBSCRIPTION_ID_MAX_LENGTH,
  SUBSCRIPTION_ID_MIN_LENGTH,
} from "./constants";
import { pathId } from "./guards";
import type { DeviceRegistrationInput } from "./types";

export interface DevicesApi {
  register(input: DeviceRegistrationInput): Promise<{ id: string }>;
  remove(subscriptionId: string): Promise<{ removed: number }>;
}

function assertLength(value: unknown, name: string, min: number, max: number): void {
  if (typeof value !== "string" || value.length < min || value.length > max) {
    throw new TypeError(`swiftgoma-mp-notifications: ${name} must be ${min} to ${max} characters`);
  }
}

export function createDevicesApi(api: AxiosInstance): DevicesApi {
  return {
    async register(input: DeviceRegistrationInput): Promise<{ id: string }> {
      assertLength(
        input.subscriptionId,
        "subscriptionId",
        SUBSCRIPTION_ID_MIN_LENGTH,
        SUBSCRIPTION_ID_MAX_LENGTH,
      );
      assertLength(input.deviceId, "deviceId", DEVICE_ID_MIN_LENGTH, DEVICE_ID_MAX_LENGTH);
      if (!PLATFORMS.includes(input.platform)) {
        throw new TypeError("swiftgoma-mp-notifications: platform must be ANDROID, IOS or WEB");
      }
      const response = await api.post<unknown>(`${NOTIFICATIONS_PATH}/devices`, {
        subscriptionId: input.subscriptionId,
        deviceId: input.deviceId,
        platform: input.platform,
      });
      return { id: readString(response, expectRecord(response), "id") };
    },

    async remove(subscriptionId: string): Promise<{ removed: number }> {
      assertLength(
        subscriptionId,
        "subscriptionId",
        SUBSCRIPTION_ID_MIN_LENGTH,
        SUBSCRIPTION_ID_MAX_LENGTH,
      );
      const response = await api.delete<unknown>(
        `${NOTIFICATIONS_PATH}/devices/${pathId(subscriptionId)}`,
      );
      return { removed: readNumber(response, expectRecord(response), "removed") };
    },
  };
}
