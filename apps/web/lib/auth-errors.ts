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

/** Shown when the account is suspended; the sign-in screens also offer the way to the Support. */
export const SUSPENDED_MESSAGE =
  "Ce compte est suspendu. Contactez le Support pour en savoir plus.";

export function authErrorMessage(error: unknown): string {
  if (isCancelled(error)) return "Connexion annulée.";
  if (error instanceof SocialLoginDisabledError) {
    return "Ce mode de connexion n’est pas disponible pour le moment.";
  }
  if (error instanceof PasskeysDisabledError) {
    return "Les clés d’accès ne sont pas disponibles sur cet appareil.";
  }
  if (hasErrorCode(error, "ACCOUNT_SUSPENDED")) return SUSPENDED_MESSAGE;
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
  if (hasErrorCode(error, ["GOOGLE_ACCOUNT_ALREADY_LINKED", "APPLE_ACCOUNT_ALREADY_LINKED"])) {
    return "Ce compte est déjà associé à un autre compte SwiftGoma. Choisissez-en un autre.";
  }
  if (hasErrorCode(error, ["GOOGLE_METHOD_ALREADY_LINKED", "APPLE_METHOD_ALREADY_LINKED"])) {
    return "Un compte de ce type est déjà lié à votre compte SwiftGoma.";
  }
  if (hasErrorCode(error, "RECOVERY_INVALID")) {
    return "Cette demande de récupération a expiré ou n’est plus valide. Recommencez.";
  }
  if (hasErrorCode(error, "RECOVERY_WAITING")) {
    return "Le délai de sécurité n’est pas encore terminé. Revenez un peu plus tard.";
  }
  if (hasErrorCode(error, "RECOVERY_BACKUP_CODE_REQUIRED")) {
    return "La double vérification est activée sur ce compte : saisissez aussi l’un de vos codes de récupération.";
  }
  if (hasErrorCode(error, "RECOVERY_NOT_FOUND")) {
    return "Aucune récupération en cours sur ce compte.";
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
