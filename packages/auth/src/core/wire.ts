import type { AuthUser, CurrentUser } from "./types";

export interface WireLoginSuccess {
  user: AuthUser;
  isNewDevice: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface WireChallenge {
  twoFactorRequired: true;
  enrollment?: true;
  challengeToken: string;
  expiresIn: number;
}

export type WireLoginResponse = WireLoginSuccess | WireChallenge;

export interface WireSignupVerified {
  user: AuthUser;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface WireEnrollConfirm extends WireLoginSuccess {
  backupCodes: string[];
}

export interface WireRefresh {
  accessToken?: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface WireNonce {
  nonce: string;
}

export interface WireMe {
  user: CurrentUser;
}
