import type { AxiosInstance } from "axios";
import { expectRecord, isRecord, unexpectedAnswer } from "./answers";
import { NOTIFICATIONS_PATH } from "./constants";
import { assertBatchSize, assertNotEmpty } from "./guards";
import type {
  CatalogEntry,
  NotificationSettings,
  PreferenceCategory,
  PreferenceChange,
  Preferences,
  SettingsPatch,
} from "./types";

export interface PreferencesApi {
  get(): Promise<Preferences>;
  update(changes: readonly PreferenceChange[]): Promise<Preferences>;
  updateSettings(patch: SettingsPatch): Promise<NotificationSettings>;
}

export interface CatalogApi {
  list(): Promise<CatalogEntry[]>;
}

export function createPreferencesApi(api: AxiosInstance): PreferencesApi {
  function toPreferences(response: Parameters<typeof unexpectedAnswer>[0]): Preferences {
    const data = expectRecord(response);
    if (!Array.isArray(data.categories) || !isRecord(data.settings)) {
      throw unexpectedAnswer(response);
    }
    return {
      categories: data.categories as PreferenceCategory[],
      settings: data.settings as unknown as NotificationSettings,
    };
  }

  return {
    async get(): Promise<Preferences> {
      return toPreferences(await api.get<unknown>(`${NOTIFICATIONS_PATH}/preferences`));
    },

    async update(changes: readonly PreferenceChange[]): Promise<Preferences> {
      assertBatchSize(changes.length);
      return toPreferences(
        await api.patch<unknown>(`${NOTIFICATIONS_PATH}/preferences`, {
          preferences: changes,
        }),
      );
    },

    async updateSettings(patch: SettingsPatch): Promise<NotificationSettings> {
      assertNotEmpty(patch, "settings");
      const response = await api.patch<unknown>(`${NOTIFICATIONS_PATH}/settings`, patch);
      const data = expectRecord(response);
      if (typeof data.timezone !== "string") throw unexpectedAnswer(response);
      return data as unknown as NotificationSettings;
    },
  };
}

export function createCatalogApi(api: AxiosInstance): CatalogApi {
  return {
    async list(): Promise<CatalogEntry[]> {
      const response = await api.get<unknown>(`${NOTIFICATIONS_PATH}/catalog`);
      const data = expectRecord(response);
      if (!Array.isArray(data.events)) throw unexpectedAnswer(response);
      return data.events as CatalogEntry[];
    },
  };
}
