import { auth } from "@/lib/auth";

export type VerificationStatus =
  "NOT_SUBMITTED" | "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "EXPIRED";

export type VerificationDocumentType =
  "ID_CARD" | "SELFIE" | "PROOF_OF_ADDRESS" | "RCCM" | "SHOP_PHOTO";

export interface VerificationDocument {
  type: VerificationDocumentType;
  mimeType: string;
  sizeBytes: number;
  expiresAt: string | null;
  createdAt?: string;
}

export interface VerificationCase {
  id: string;
  type: "SELLER" | "RIDER";
  status: VerificationStatus;
  attempt: number;
  taxNumber: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  documents: VerificationDocument[];
}

export interface ChecklistItem {
  type: VerificationDocumentType;
  sent: boolean;
}

export interface MyVerification {
  verificationStatus: VerificationStatus;
  attemptsLeft: number;
  checklist: { required: ChecklistItem[]; optional: ChecklistItem[] } | null;
  case: VerificationCase | null;
}

/** Mirrors `verificationConfig` on the server. */
export const VERIFICATION_FILE_MAX_BYTES = 5 * 1024 * 1024;
export const VERIFICATION_IMAGE_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];
export const VERIFICATION_DOCUMENT_TYPES: readonly string[] = [
  ...VERIFICATION_IMAGE_TYPES,
  "application/pdf",
];
export const IMAGE_ONLY_DOCUMENTS: readonly VerificationDocumentType[] = ["SELFIE", "SHOP_PHOTO"];
export const TAX_NUMBER_LIMITS = { min: 3, max: 40 } as const;

export const verificationApi = {
  getMine: async () => (await auth.api.get<MyVerification>("/verification/me")).data,

  start: async () =>
    (await auth.api.post<{ case: VerificationCase }>("/verification/start")).data.case,

  saveDetails: async (details: { taxNumber: string }) =>
    (await auth.api.patch<{ case: VerificationCase }>("/verification/details", details)).data.case,

  uploadDocument: async (type: VerificationDocumentType, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return (
      await auth.api.put<{ document: VerificationDocument }>(
        `/verification/documents/${type}`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      )
    ).data.document;
  },

  removeDocument: async (type: VerificationDocumentType) => {
    await auth.api.delete(`/verification/documents/${type}`);
  },

  submit: async () => (await auth.api.post<MyVerification>("/verification/submit")).data,
};
