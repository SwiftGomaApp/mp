import type { AxiosResponse } from "axios";
import { createApiError } from "swiftgoma-mp-auth";
import type { ApiError } from "swiftgoma-mp-auth";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function unexpectedAnswer(response: AxiosResponse<unknown>): ApiError {
  return createApiError({ status: response.status, body: response.data });
}

export function expectRecord(response: AxiosResponse<unknown>): Record<string, unknown> {
  if (!isRecord(response.data)) throw unexpectedAnswer(response);
  return response.data;
}

export function readNumber(
  response: AxiosResponse<unknown>,
  data: Record<string, unknown>,
  key: string,
): number {
  const value = data[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw unexpectedAnswer(response);
  return value;
}

export function readString(
  response: AxiosResponse<unknown>,
  data: Record<string, unknown>,
  key: string,
): string {
  const value = data[key];
  if (typeof value !== "string") throw unexpectedAnswer(response);
  return value;
}

export function readNullableString(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === "string" ? value : null;
}
