import type { Role } from "swiftgoma-mp-auth";

export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export type VerificationStatus =
  | "NOT_SUBMITTED"
  | "PENDING"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED";

export const USER_STATUSES = [
  "PENDING",
  "PENDING_APPROVAL",
  "ACTIVE",
  "SUSPENDED",
  "BANNED",
  "DELETED",
  "PENDING_DELETION",
] as const;

export const ALL_ROLES: Role[] = ["BUYER", "SELLER", "RIDER", "SUPPORT", "ADMIN"];
export const ASSIGNABLE_ROLES = ["BUYER", "SELLER", "RIDER"] as const;

export interface AdminUserRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: Role;
  status: string;
  verificationStatus: VerificationStatus;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminUserDetail extends AdminUserRow {
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  secondaryEmail: string | null;
  secondaryPhone: string | null;
  termsVersion: string | null;
  termsAcceptedAt: string | null;
  deletionRequestedAt: string | null;
  deletionScheduledAt: string | null;
  deletedAt: string | null;
  updatedAt: string;
  addresses: Record<string, unknown>[];
  supportRequests: { id: string; message: string; status: string; createdAt: string }[];
  _count: { sessions: number; passkeys: number };
}

export interface ActivityRow {
  id: string;
  userId: string | null;
  event: string;
  success: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export type VerificationType = "SELLER" | "RIDER";
export type Opinion = "RECOMMEND_APPROVE" | "RECOMMEND_REJECT";
export type CallOutcome = "REACHED" | "NO_ANSWER" | "WRONG_NUMBER" | "REFUSED";
export type DocumentType =
  | "ID_CARD"
  | "SELFIE"
  | "PROOF_OF_ADDRESS"
  | "RCCM"
  | "SHOP_PHOTO"
  | "DRIVING_LICENCE"
  | "VEHICLE_PHOTO"
  | "VEHICLE_DOCUMENT"
  | "VEHICLE_INSURANCE";

export interface CaseRow {
  id: string;
  type: VerificationType;
  status: VerificationStatus;
  attempt: number;
  submittedAt: string;
  opinion: Opinion | null;
  user: { id: string; name: string | null; phone: string | null; email: string | null };
  reviewer: { id: string; name: string | null } | null;
  _count: { documents: number; calls: number };
}

export interface CaseCall {
  id: string;
  phone: string;
  outcome: CallOutcome;
  notes: string | null;
  calledAt: string;
  caller: { id: string; name: string | null };
}

export interface CaseDetail {
  id: string;
  type: VerificationType;
  status: VerificationStatus;
  attempt: number;
  taxNumber: string | null;
  vehicleType: "MOTO" | "CAR" | null;
  plateNumber: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  opinion: Opinion | null;
  opinionNote: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  reviewerId: string | null;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    role: Role;
    createdAt: string;
  };
  reviewer: { id: string; name: string | null } | null;
  decidedBy: { id: string; name: string | null } | null;
  documents: {
    id: string;
    type: DocumentType;
    mimeType: string;
    sizeBytes: number;
    expiresAt: string | null;
    createdAt: string;
  }[];
  calls: CaseCall[];
  previousRejections: number;
  samePlate: { id: string; status: VerificationStatus; user: { id: string; name: string | null } }[];
}
