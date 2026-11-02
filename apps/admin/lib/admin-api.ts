import { auth } from "@/lib/auth";
import type {
  ActivityRow,
  AdminUserDetail,
  AdminUserRow,
  CallOutcome,
  CaseDetail,
  CaseRow,
  DocumentType,
  Opinion,
  Page,
} from "@/lib/types";

type Params = Record<string, string | number | boolean | undefined>;

const clean = (params: Params): Params =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ""));

const get = async <T>(url: string, params: Params = {}): Promise<T> =>
  (await auth.api.get<T>(url, { params: clean(params) })).data;

const post = async <T = unknown>(url: string, body?: object): Promise<T> =>
  (await auth.api.post<T>(url, body ?? {})).data;

const enc = encodeURIComponent;

// ===================================== /admin (users) =====================================
export const adminApi = {
  listUsers: (q: Params) => get<Page<AdminUserRow>>("/admin/users", q),
  getUser: async (id: string) =>
    (await get<{ user: AdminUserDetail }>(`/admin/users/${enc(id)}`)).user,
  listActivity: (id: string, q: Params) =>
    get<Page<ActivityRow>>(`/admin/users/${enc(id)}/activity`, q),
  listAudit: (q: Params) => get<Page<ActivityRow>>("/admin/activity", q),

  suspend: (id: string, reason: string) => post(`/admin/users/${enc(id)}/suspend`, { reason }),
  ban: (id: string, reason: string) => post(`/admin/users/${enc(id)}/ban`, { reason }),
  reactivate: (id: string, reason: string) =>
    post(`/admin/users/${enc(id)}/reactivate`, { reason }),
  revokeSessions: (id: string, reason: string) =>
    post(`/admin/users/${enc(id)}/revoke-sessions`, { reason }),
  unlock: (id: string, reason: string) => post(`/admin/users/${enc(id)}/unlock`, { reason }),
  cancelDeletion: (id: string, reason: string) =>
    post(`/admin/users/${enc(id)}/deletion/cancel`, { reason }),

  changeRole: async (id: string, role: string, reason: string) =>
    (await auth.api.patch(`/admin/users/${enc(id)}/role`, { role, reason })).data,
  moderateProfile: async (
    id: string,
    body: { reason: string; removeAvatar: boolean; clearName: boolean },
  ) => (await auth.api.patch(`/admin/users/${enc(id)}/profile`, body)).data,
  updateContact: async (
    id: string,
    body: { reason: string; field: "email" | "phone"; value?: string },
  ) => (await auth.api.patch(`/admin/users/${enc(id)}/contact`, body)).data,

  // Destructive: also need the acting admin's step-up code.
  forceDeletion: (id: string, reason: string, stepUpCode: string) =>
    post(`/admin/users/${enc(id)}/deletion/force`, { reason, stepUpCode }),
  resetPassword: (id: string, reason: string, stepUpCode: string) =>
    post(`/admin/users/${enc(id)}/reset-password`, { reason, stepUpCode }),
  resetTwoFactor: (id: string, reason: string, stepUpCode: string) =>
    post(`/admin/users/${enc(id)}/reset-2fa`, { reason, stepUpCode }),

  /** The export as JSON text; the server sends it as an attachment. */
  exportUserData: async (id: string, reason: string): Promise<string> => {
    const response = await auth.api.post<unknown>(
      `/admin/users/${enc(id)}/export`,
      { reason },
      { transformResponse: (data: unknown) => data },
    );
    return typeof response.data === "string"
      ? response.data
      : JSON.stringify(response.data, null, 2);
  },
};

// ===================================== /admin/verification =====================================
export const verificationApi = {
  listCases: (q: Params) => get<Page<CaseRow>>("/admin/verification/cases", q),
  getCase: async (id: string) =>
    (await get<{ case: CaseDetail }>(`/admin/verification/cases/${enc(id)}`)).case,
  take: async (id: string) => {
    await post(`/admin/verification/cases/${enc(id)}/take`);
  },
  logCall: async (id: string, body: { outcome: CallOutcome; notes?: string; phone?: string }) =>
    (await post<{ call: unknown }>(`/admin/verification/cases/${enc(id)}/calls`, body)).call,
  giveOpinion: async (id: string, body: { opinion: Opinion; note?: string }) =>
    (await auth.api.put(`/admin/verification/cases/${enc(id)}/opinion`, body)).data,
  documentLink: (id: string, type: DocumentType) =>
    get<{ url: string; mimeType: string; expiresInSeconds: number }>(
      `/admin/verification/cases/${enc(id)}/documents/${enc(type)}/link`,
    ),
  approve: async (id: string, note?: string) => {
    await post(`/admin/verification/cases/${enc(id)}/approve`, { note });
  },
  reject: (id: string, note: string) =>
    post<{ attemptsLeft: number }>(`/admin/verification/cases/${enc(id)}/reject`, { note }),
};
