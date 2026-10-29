import type { Platform, Role } from "./constants";

export const USER_STATUSES = [
  "PENDING",
  "PENDING_APPROVAL",
  "ACTIVE",
  "SUSPENDED",
  "BANNED",
  "DELETED",
] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const VERIFICATION_STATUSES = [
  "NOT_SUBMITTED",
  "PENDING",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** The user as every sign-in answer returns it. */
export interface AuthUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  status: UserStatus;
}

/** The user as `me()` returns it. */
export interface CurrentUser extends AuthUser {
  emailVerified: boolean;
  phoneVerified: boolean;
  hasPassword: boolean;
  verificationStatus: VerificationStatus;
  twoFactorEnabled: boolean;
  /** ISO dates. */
  createdAt: string;
  lastLoginAt: string | null;
  sessionId: string;
}

/** One signed-in device, as `devices.list()` returns it. */
export interface DeviceSession {
  id: string;
  deviceName: string | null;
  platform: Platform;
  city: string | null;
  country: string | null;
  ipAddress: string | null;
  /** ISO dates. */
  createdAt: string;
  lastSeenAt: string | null;
  /** True for the device that is asking. */
  current: boolean;
}

/** A code was sent. `target` is where, masked when it was sent to a different contact. */
export interface OtpSent {
  method: "EMAIL" | "PHONE";
  target: string;
  expiresMinutes: number;
}

export type ContactTarget = { email: string; phone?: never } | { phone: string; email?: never };

/** How a sign-in ended. A second step keeps its token inside the package. */
export type LoginResult =
  | { status: "authenticated"; user: AuthUser; isNewDevice: boolean }
  | { status: "twoFactorRequired"; expiresInSeconds: number }
  | { status: "twoFactorEnrollmentRequired"; expiresInSeconds: number };
