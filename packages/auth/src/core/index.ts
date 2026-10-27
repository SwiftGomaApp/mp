export const PACKAGE_NAME = "@swiftgoma/auth";

export * from "./adapters";
export * from "./config";
export * from "./constants";
export * from "./errors";
export * from "./memoryStore";
export * from "./types";
export * from "./http";
export * from "./jwt";
export * from "./session";
export * from "./auth";
export type { AccountApi } from "./account";
export type { LoginApi } from "./login";
export type { SignupApi } from "./signup";
export type {
  EmailCodeRequestInput,
  EmailCodeVerifyInput,
  PasswordLoginInput,
  PhoneCodeRequestInput,
  PhoneCodeVerifyInput,
} from "./login";
export type {
  SignupEmailInput,
  SignupPhoneInput,
  SignupResult,
  VerifyEmailInput,
  VerifyPhoneInput,
} from "./signup";
export type {
  AuthenticatedLogin,
  TwoFactorApi,
  TwoFactorConfirmInput,
  TwoFactorVerifyInput,
} from "./twoFactor.ts";
