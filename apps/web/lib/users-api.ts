import type { Role } from "swiftgoma-mp-auth";

import { auth } from "@/lib/auth";

export interface UserProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  avatarUrl: string | null;
  role: Role;
  status: string;
  verificationStatus: string;
  createdAt: string;
}

export interface Address {
  id: string;
  label: string;
  recipientName: string | null;
  recipientPhone: string | null;
  line1: string;
  quartier: string | null;
  commune: string | null;
  city: string;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AddressInput {
  label: string;
  recipientName: string | null;
  recipientPhone: string | null;
  line1: string;
  quartier: string | null;
  commune: string | null;
  city: string;
  landmark: string | null;
  /** Both or neither: the server refuses one without the other. */
  latitude?: number | null;
  longitude?: number | null;
  isDefault?: boolean;
}

/** Mirrors `usersConfig` on the server. */
export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 80;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MIME_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/webp"];
export const MAX_ADDRESSES = 10;
export const ADDRESS_LIMITS = {
  label: 40,
  recipientName: 80,
  line1: 160,
  quartier: 80,
  commune: 80,
  landmark: 160,
} as const;

export type ContactKind = "EMAIL" | "PHONE";

export interface ContactChangeRequested {
  message: string;
  kind: ContactKind;
  /** The contact as the server normalised it: use it to verify. */
  contact: string;
  expiresMinutes: number;
}

export interface SuspiciousActivityReport {
  message: string;
  loggedOutDevices: number;
  passwordCleared: boolean;
}

export type ThemePreference = "LIGHT" | "DARK" | "SYSTEM";
export type ReviewNameDisplay = "FULL_NAME" | "FIRST_NAME_INITIAL" | "ANONYMOUS";
export type NewOrderSound = "default" | "bell" | "chime" | "alert";

/** The server only returns the keys the role may use: buyer and seller keys are optional. */
export interface UserPreferences {
  theme: ThemePreference;
  dataSaver: boolean;
  preferredMomoNumber?: string | null;
  reviewNameDisplay?: ReviewNameDisplay;
  newOrderSound?: NewOrderSound;
}

export interface DeletionOverview {
  canDelete: boolean;
  blockers: unknown[];
  gracePeriodDays: number;
  erased: { addresses: number };
  kept: string[];
}

export const DELETION_CONFIRMATION = "SUPPRIMER";

export const usersApi = {
  getPreferences: async () =>
    (await auth.api.get<{ preferences: UserPreferences }>("/users/me/preferences")).data
      .preferences,

  updatePreferences: async (input: Partial<UserPreferences>) =>
    (await auth.api.patch<{ preferences: UserPreferences }>("/users/me/preferences", input)).data
      .preferences,

  getDeletionOverview: async () =>
    (await auth.api.get<DeletionOverview>("/users/me/deletion")).data,

  /** Schedules the deletion: every session is closed on the server. */
  requestDeletion: async (stepUpCode: string) =>
    (
      await auth.api.post<{ message: string; scheduledAt: string }>("/users/me/deletion", {
        stepUpCode,
        confirmation: DELETION_CONFIRMATION,
      })
    ).data,

  /** Returns everything the platform holds about the account, as a JSON document. */
  exportData: async (stepUpCode: string) =>
    (await auth.api.post<unknown>("/users/me/export", { stepUpCode })).data,

  /** "It wasn't me": signs out every device, removes the password and alerts the Support. */
  reportNotMe: async (activityId: string) =>
    (
      await auth.api.post<SuspiciousActivityReport>(
        `/users/me/activity/${encodeURIComponent(activityId)}/not-me`,
      )
    ).data,

  /** Sends a code to the new contact. `stepUpCode` proves it is really the account owner. */
  requestContactChange: async (input: { kind: ContactKind; value: string; stepUpCode: string }) =>
    (await auth.api.post<ContactChangeRequested>("/users/me/contact/otp", input)).data,

  verifyContactChange: async (input: { kind: ContactKind; value: string; code: string }) =>
    (await auth.api.post<{ message: string; user: UserProfile }>("/users/me/contact/verify", input))
      .data.user,

  getProfile: async () => (await auth.api.get<{ user: UserProfile }>("/users/me")).data.user,

  updateName: async (name: string) =>
    (await auth.api.patch<{ user: UserProfile }>("/users/me", { name })).data.user,

  uploadAvatar: async (file: File) => {
    const form = new FormData();
    form.append("avatar", file);
    const response = await auth.api.put<{ user: UserProfile }>("/users/me/avatar", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data.user;
  },

  removeAvatar: async () =>
    (await auth.api.delete<{ user: UserProfile }>("/users/me/avatar")).data.user,

  listAddresses: async () =>
    (await auth.api.get<{ addresses: Address[] }>("/users/me/addresses")).data.addresses,

  createAddress: async (input: AddressInput) =>
    (await auth.api.post<{ address: Address }>("/users/me/addresses", input)).data.address,

  updateAddress: async (id: string, input: Partial<AddressInput>) =>
    (
      await auth.api.patch<{ address: Address }>(
        `/users/me/addresses/${encodeURIComponent(id)}`,
        input,
      )
    ).data.address,

  removeAddress: async (id: string) => {
    await auth.api.delete(`/users/me/addresses/${encodeURIComponent(id)}`);
  },
};
