export const API_PREFIX = "/api/v1";

export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
export const REQUEST_ID_HEADER = "x-request-id";
export const PLATFORMS = ["ANDROID", "IOS", "WEB"] as const;
export type Platform = (typeof PLATFORMS)[number];
export const SELF_SIGNUP_ROLES = ["BUYER", "SELLER", "RIDER"] as const;
export type SelfSignupRole = (typeof SELF_SIGNUP_ROLES)[number];
export const ROLES = ["BUYER", "SELLER", "RIDER", "SUPPORT", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];
export const DEVICE_ID_MIN_LENGTH = 8;
export const DEVICE_ID_MAX_LENGTH = 128;
export const DEVICE_NAME_MAX_LENGTH = 100;

export const OTP_CODE_LENGTH = 6;
