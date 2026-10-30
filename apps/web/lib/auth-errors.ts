import {
  hasErrorCode,
  isApiError,
  PasskeysDisabledError,
  SocialLoginDisabledError,
  TooManyRequestsError,
} from "swiftgoma-mp-auth";

import { ProviderCancelledError } from "@/lib/auth-providers";

function isCancelled(error: unknown): boolean {
  const cause = error instanceof Error ? error.cause : undefined;
  return [error, cause].some(
    (value) =>
      value instanceof ProviderCancelledError ||
      (value instanceof DOMException && ["NotAllowedError", "AbortError"].includes(value.name)),
  );
}

export function authErrorMessage(error: unknown): string {
  if (isCancelled(error)) return "Connexion annulée.";
  if (error instanceof SocialLoginDisabledError) {
    return "Ce mode de connexion n’est pas disponible pour le moment.";
  }
  if (error instanceof PasskeysDisabledError) {
    return "Les clés d’accès ne sont pas disponibles sur cet appareil.";
  }
  if (hasErrorCode(error, "ACCOUNT_NOT_FOUND")) {
    return "Aucun compte trouvé. Inscrivez-vous d’abord.";
  }
  if (hasErrorCode(error, ["GOOGLE_TOKEN_INVALID", "GOOGLE_NONCE_INVALID"])) {
    return "Connexion Google refusée. Réessayez.";
  }
  if (hasErrorCode(error, ["PASSKEY_INVALID", "PASSKEY_CHALLENGE_EXPIRED"])) {
    return "Clé d’accès refusée ou expirée. Réessayez.";
  }
  if (hasErrorCode(error, "OTP_INVALID")) {
    return "Code incorrect ou expiré. Vérifiez-le et réessayez.";
  }
  if (hasErrorCode(error, "OTP_ATTEMPTS_EXCEEDED")) {
    return "Trop de tentatives. Demandez un nouveau code.";
  }
  if (hasErrorCode(error, "OTP_COOLDOWN")) {
    return "Veuillez patienter avant de demander un nouveau code.";
  }
  if (hasErrorCode(error, "OTP_HOURLY_LIMIT")) {
    return "Limite de codes atteinte. Réessayez dans une heure.";
  }
  if (hasErrorCode(error, ["ACCOUNT_EXISTS", "ALREADY_EXISTS"])) {
    return "Un compte existe déjà avec ces informations. Connectez-vous.";
  }
  if (hasErrorCode(error, "INVALID_PHONE")) {
    return "Numéro de téléphone invalide. Seuls les numéros de la RDC sont acceptés.";
  }
  if (hasErrorCode(error, "INVALID_CREDENTIALS")) {
    return "E-mail ou mot de passe incorrect.";
  }
  if (hasErrorCode(error, "PASSWORD_LOCKED")) {
    return "Connexion par mot de passe verrouillée après trop d’échecs. Utilisez un code ou réessayez plus tard.";
  }
  if (hasErrorCode(error, "TWO_FACTOR_INVALID")) {
    return "Code incorrect. Saisissez le code actuel de votre application.";
  }
  if (hasErrorCode(error, "TWO_FACTOR_CHALLENGE_EXPIRED")) {
    return "La vérification a expiré. Reconnectez-vous.";
  }
  if (hasErrorCode(error, "TWO_FACTOR_LOCKED")) {
    return "Double vérification verrouillée après trop d’échecs. Réessayez plus tard.";
  }
  if (error instanceof TooManyRequestsError) {
    return error.retryAfterSeconds
      ? `Trop de tentatives. Réessayez dans ${error.retryAfterSeconds} s.`
      : "Trop de tentatives. Réessayez dans un instant.";
  }
  if (isApiError(error) && (error.name === "NetworkError" || error.name === "TimeoutError")) {
    return "Connexion impossible. Vérifiez votre réseau et réessayez.";
  }
  return "Une erreur est survenue. Réessayez.";
}

export const isTwoFactorExpired = (error: unknown) =>
  hasErrorCode(error, ["TWO_FACTOR_CHALLENGE_EXPIRED", "TWO_FACTOR_LOCKED"]);
