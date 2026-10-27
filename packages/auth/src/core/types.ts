import type { Platform, UserRole } from "./constants";

export type UserStatus =
  "PENDING" | "PENDING_APPROVAL" | "ACTIVE" | "SUSPENDED" | "BANNED" | "DELETED";

export type VerificationStatus =
  "NOT_SUBMITTED" | "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
}

export interface ResendResult {
  message: string;
}

export interface CurrentUser extends AuthUser {
  emailVerified: boolean;
  phoneVerified: boolean;
  hasPassword: boolean;
  twoFactorEnabled: boolean;
  verificationStatus: VerificationStatus;
  createdAt: string;
  lastLoginAt: string | null;
  sessionId: string;
}

export interface DeviceInfo {
  deviceId: string;
  deviceName?: string | undefined;
  platform: Platform;
}

export type OtpChannel = "EMAIL" | "PHONE";

export interface CodeRequested {
  method: OtpChannel;
  target: string;
  expiresMinutes: string;
}

export type LoginResult =
  | { status: "authenticated"; user: AuthUser; isNewDevice: boolean }
  | { status: "two_factor_required"; challengeExpiresIn: number }
  | { status: "two_factor_enrollment_required"; challengeExpiresIn: number };

export interface TwoFactorSetup {
  secret: string;
  otpauthUri: string;
}

export interface EnrollmentResult {
  user: AuthUser;
  isNewDevice: boolean;
  backupCodes: string[];
}

export interface LogoutAllResult {
  revoked: number;
}

export interface SessionRecord {
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: number;
}
