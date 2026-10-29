import { isApiError } from "@swiftgoma/auth";

/** A message to show the user. The server's and the package's messages are already in French. */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) return error.message;
  return "Une erreur est survenue, veuillez réessayer.";
}
