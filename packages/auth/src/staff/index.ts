import type { AxiosResponse } from "axios";
import { isRecord, unexpectedAnswer } from "../core/answers";
import type { Auth } from "../core/create-auth";
import type { Role } from "../core/constants";
import type { UserStatus } from "../core/types";

export type SupportRequestStatus = "OPEN" | "CLOSED";

export interface StaffAccount {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
}

export interface SupportRequest {
  id: string;
  message: string;
  status: SupportRequestStatus;
  note: string | null;
  closedBy: string | null;
  closedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    role: Role;
    status: UserStatus;
  };
}

export interface SupportRequestPage {
  items: SupportRequest[];
  page: number;
  limit: number;
  total: number;
}

export interface StaffApi {
  /** Creates a Support account and e-mails the setup link. Admin only. `code` is a step-up code. */
  create(input: { name: string; email: string; code: string }): Promise<StaffAccount>;
  /**
   * Finishes a staff account from the e-mailed link: sets the password. Needs no session.
   * The link carries the `token`.
   */
  setup(input: { token: string; newPassword: string }): Promise<{ message: string }>;
  /** Sends a new setup link to a staff member who has not finished. Admin only. */
  resendSetup(id: string, input: { code: string }): Promise<{ message: string }>;
  /** Turns off a staff member's two-step verification, for example after a lost phone. Admin only. */
  resetTwoFactor(
    id: string,
    input: { code: string; reason: string },
  ): Promise<{ id: string; twoFactorEnabled: false }>;
  supportRequests: {
    /** Open or closed requests from suspended users. Support and Admin. */
    list(query?: {
      status?: SupportRequestStatus;
      page?: number;
      limit?: number;
    }): Promise<SupportRequestPage>;
    /** Closes a request, with an optional note. Admin only. */
    close(id: string, input?: { note?: string }): Promise<{ id: string; status: "CLOSED" }>;
  };
}

function record(response: AxiosResponse<unknown>): Record<string, unknown> {
  if (!isRecord(response.data)) throw unexpectedAnswer(response);
  return response.data;
}

/** The staff operations of the admin dashboard. The server checks the role on every call. */
export function createStaff(auth: Auth): StaffApi {
  const api = auth.api;
  const send = async <T>(method: "get" | "post", path: string, body?: object): Promise<T> =>
    record(await api.request<unknown>({ method, url: path, data: body })) as T;
  const id = (value: string): string => encodeURIComponent(value);

  return {
    create: (input) => send("post", "/auth/staff", input),
    setup: (input) => send("post", "/auth/staff/setup", input),
    resendSetup: (staffId, input) => send("post", `/auth/staff/${id(staffId)}/resend-setup`, input),
    resetTwoFactor: (staffId, input) => send("post", `/auth/staff/${id(staffId)}/reset-2fa`, input),

    supportRequests: {
      async list(query): Promise<SupportRequestPage> {
        const response = await api.get<unknown>("/auth/support-requests", { params: query });
        return record(response) as unknown as SupportRequestPage;
      },
      close: (requestId, input = {}) =>
        send("post", `/auth/support-requests/${id(requestId)}/close`, input),
    },
  };
}
