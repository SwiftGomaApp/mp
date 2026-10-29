import type { AxiosResponse } from "axios";
import { isRecord, unexpectedAnswer } from "../core/answers";
import type { Auth } from "../core/create-auth";
import { createPasskeysDisabledError, createSocialLoginDisabledError } from "../core/errors";
import type { PasskeyJson, PasskeyProvider } from "../core/passkey-api";
import type { SocialProviders } from "../core/social-api";
import type { SecondFactor, TwoFactorSetup } from "../core/two-factor-api";
import type { ContactTarget } from "../core/types";

// What the server answers for the account features. Dates are ISO strings.

export interface TwoFactorStatus {
  enabled: boolean;
  /** Staff accounts must keep it on. */
  mandatory: boolean;
  backupCodesRemaining: number;
}

export interface Passkey {
  id: string;
  name: string;
  deviceId: string | null;
  algorithm: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** Sign-in methods of the account. `null` means the method is not set up. */
export interface SignInMethods {
  email: { value: string; verified: boolean } | null;
  phone: { value: string; verified: boolean } | null;
  password: boolean;
  google: { email: string | null } | null;
  apple: { email: string | null } | null;
  /** How many passkeys are registered. */
  passkeys: number;
}

export type ContactKind = "EMAIL" | "PHONE";
export type RemovableMethod = "EMAIL" | "PHONE" | "GOOGLE" | "APPLE";

export interface RecoveryContacts {
  secondaryEmail: string | null;
  secondaryEmailVerifiedAt: string | null;
  secondaryPhone: string | null;
  secondaryPhoneVerifiedAt: string | null;
}

export interface ContactCodeSent {
  message: string;
  kind: ContactKind;
  contact: string;
  expiresMinutes: number;
}

export type ActivityCategory = "LOGIN" | "DEVICE" | "SECURITY";

export interface ActivityItem {
  id: string;
  event: string;
  success: boolean;
  method: string | null;
  deviceName: string | null;
  platform: string | null;
  city: string | null;
  country: string | null;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface SecurityChecklist {
  items: { key: string; done: boolean }[];
  /** A recovery waiting for its delay to pass, if any. */
  pendingRecovery: { id: string; availableAt: string } | null;
}

export interface AccountOptions {
  /** Needed to link Google or Apple. The same providers given to `createAuth`. */
  socials?: SocialProviders;
  /** Needed to register a passkey. The same provider given to `createAuth`. */
  passkeys?: PasskeyProvider;
}

export interface AccountApi {
  twoFactor: {
    status(): Promise<TwoFactorStatus>;
    /** Starts the setup: the app shows the secret or a QR code from the address. */
    setup(): Promise<TwoFactorSetup>;
    /** Turns it on with the first app code. Returns the backup codes, shown only once. */
    confirm(input: { code: string; stepUpCode: string }): Promise<{ backupCodes: string[] }>;
    disable(factor: SecondFactor): Promise<{ enabled: false }>;
    regenerateBackupCodes(factor: SecondFactor): Promise<{ backupCodes: string[] }>;
  };
  passkeys: {
    list(): Promise<Passkey[]>;
    /** Asks the device to create a passkey and registers it. */
    register(input: { stepUpCode: string; name?: string; deviceId?: string }): Promise<Passkey>;
    rename(id: string, name: string): Promise<{ id: string; name: string }>;
    remove(id: string): Promise<void>;
  };
  /** Links a Google or Apple account to the signed-in user. */
  link: {
    google(input: { stepUpCode: string }): Promise<{ alreadyLinked: boolean }>;
    apple(input: { stepUpCode: string }): Promise<{ alreadyLinked: boolean }>;
  };
  methods: {
    list(): Promise<SignInMethods>;
    /** Removes a sign-in method. The account must keep another one. */
    remove(method: RemovableMethod, input: { code: string }): Promise<SignInMethods>;
  };
  recoveryContacts: {
    list(): Promise<RecoveryContacts>;
    /** Sends a code to the new contact. */
    requestCode(input: {
      kind: ContactKind;
      value: string;
      stepUpCode: string;
    }): Promise<ContactCodeSent>;
    verify(input: {
      kind: ContactKind;
      value: string;
      code: string;
    }): Promise<{ message: string; kind: ContactKind; contact: string; verified: true }>;
    remove(input: { kind: ContactKind; stepUpCode: string }): Promise<RecoveryContacts>;
  };
  /** Getting back into an account whose owner lost the usual contacts. */
  recovery: {
    request(input: ContactTarget & { kind?: ContactKind }): Promise<{ message: string }>;
    verify(
      input: ContactTarget & { kind?: ContactKind; code: string },
    ): Promise<{ recoveryToken: string; availableAt: string }>;
    setNewContact(input: {
      token: string;
      kind: ContactKind;
      value: string;
    }): Promise<ContactCodeSent>;
    complete(input: {
      token: string;
      kind: ContactKind;
      value: string;
      code: string;
      backupCode?: string;
    }): Promise<{ recovered: true }>;
    /** Cancels a recovery someone started on this account. */
    cancel(): Promise<{ cancelled: true }>;
  };
  activity(query?: {
    page?: number;
    limit?: number;
    category?: ActivityCategory;
  }): Promise<Page<ActivityItem>>;
  security(): Promise<SecurityChecklist>;
  /** For a suspended account: asks Support for help. The answer is the same for any address. */
  supportRequest(input: ContactTarget & { message: string }): Promise<{ message: string }>;
}

function record(response: AxiosResponse<unknown>): Record<string, unknown> {
  if (!isRecord(response.data)) throw unexpectedAnswer(response);
  return response.data;
}

export function createAccount(auth: Auth, options: AccountOptions = {}): AccountApi {
  const api = auth.api;
  const get = async <T>(path: string, params?: object): Promise<T> =>
    record(await api.get<unknown>(path, { params })) as T;
  const send = async <T>(
    method: "post" | "put" | "patch" | "delete",
    path: string,
    body?: object,
  ): Promise<T> => record(await api.request<unknown>({ method, url: path, data: body })) as T;

  // A provider needs a nonce first, then gives the token that carries it.
  const idTokenFrom = async (
    name: "google" | "apple",
  ): Promise<{ idToken: string; nonce: string }> => {
    const provider = options.socials?.[name];
    if (!provider) throw createSocialLoginDisabledError(name);
    const answer = await send<{ nonce?: unknown }>("post", "/auth/oauth/nonce");
    if (typeof answer.nonce !== "string") {
      throw new TypeError("swiftgoma-mp-auth: the server sent no nonce");
    }
    const idToken = await provider.getIdToken(answer.nonce);
    if (!idToken)
      throw new TypeError(`swiftgoma-mp-auth: the ${name} provider returned no ID token`);
    return { idToken, nonce: answer.nonce };
  };

  const linked = async (path: string, body: object): Promise<{ alreadyLinked: boolean }> => {
    const answer = await send<{ alreadyLinked?: unknown }>("post", path, body);
    return { alreadyLinked: answer.alreadyLinked === true };
  };

  return {
    twoFactor: {
      status: () => get<TwoFactorStatus>("/auth/2fa"),
      setup: () => send<TwoFactorSetup>("post", "/auth/2fa/setup"),
      confirm: (input) => send("post", "/auth/2fa/confirm", input),
      disable: (factor) => send("post", "/auth/2fa/disable", factor),
      regenerateBackupCodes: (factor) => send("post", "/auth/2fa/backup-codes", factor),
    },

    passkeys: {
      async list(): Promise<Passkey[]> {
        const answer = await get<{ passkeys?: unknown }>("/auth/passkeys");
        return Array.isArray(answer.passkeys) ? (answer.passkeys as Passkey[]) : [];
      },

      async register({ stepUpCode, name, deviceId }): Promise<Passkey> {
        const provider = options.passkeys;
        if (!provider) throw createPasskeysDisabledError();
        const registration = await send<PasskeyJson>("post", "/auth/passkeys/options");
        const response = await provider.createCredential(registration);
        const answer = await send<{ passkey: Passkey }>("post", "/auth/passkeys/verify", {
          response,
          stepUpCode,
          ...(name === undefined ? {} : { name }),
          ...(deviceId === undefined ? {} : { deviceId }),
        });
        return answer.passkey;
      },

      rename: (id, name) => send("patch", `/auth/passkeys/${encodeURIComponent(id)}`, { name }),

      async remove(id): Promise<void> {
        await api.delete(`/auth/passkeys/${encodeURIComponent(id)}`);
      },
    },

    link: {
      async google({ stepUpCode }) {
        const { idToken } = await idTokenFrom("google");
        return linked("/auth/google/link", { idToken, stepUpCode });
      },
      async apple({ stepUpCode }) {
        const { idToken, nonce } = await idTokenFrom("apple");
        return linked("/auth/apple/link", { idToken, nonce, stepUpCode });
      },
    },

    methods: {
      list: () => get<SignInMethods>("/auth/methods"),
      remove: (method, input) =>
        send("post", `/auth/methods/${encodeURIComponent(method)}/remove`, input),
    },

    recoveryContacts: {
      list: () => get<RecoveryContacts>("/auth/secondary-contacts"),
      requestCode: (input) => send("post", "/auth/secondary-contacts/otp", input),
      verify: (input) => send("post", "/auth/secondary-contacts/verify", input),
      remove: (input) => send("post", "/auth/secondary-contacts/remove", input),
    },

    recovery: {
      request: (input) => send("post", "/auth/recovery/request", input),
      verify: (input) => send("post", "/auth/recovery/verify", input),
      setNewContact: (input) => send("post", "/auth/recovery/contact", input),
      complete: (input) => send("post", "/auth/recovery/complete", input),
      cancel: () => send("post", "/auth/recovery/cancel"),
    },

    activity: (query) => get<Page<ActivityItem>>("/auth/activity", query),
    security: () => get<SecurityChecklist>("/auth/security"),
    supportRequest: (input) => send("post", "/auth/support-request", input),
  };
}
