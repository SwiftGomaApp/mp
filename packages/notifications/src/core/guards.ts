import { INBOX_PAGE_SIZE_MAX, PREFERENCES_BATCH_MAX } from "./constants";

const PREFIX = "swiftgoma-mp-notifications";

export function assertId(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${PREFIX}: ${name} is required`);
  }
}

export function assertLimit(limit: number | undefined): void {
  if (limit === undefined) return;
  if (!Number.isInteger(limit) || limit < 1 || limit > INBOX_PAGE_SIZE_MAX) {
    throw new TypeError(`${PREFIX}: limit must be a whole number from 1 to ${INBOX_PAGE_SIZE_MAX}`);
  }
}

export function assertBatchSize(size: number): void {
  if (size < 1 || size > PREFERENCES_BATCH_MAX) {
    throw new TypeError(`${PREFIX}: change from 1 to ${PREFERENCES_BATCH_MAX} preferences at once`);
  }
}

export function assertNotEmpty(patch: object, name: string): void {
  if (Object.keys(patch).length === 0) throw new TypeError(`${PREFIX}: ${name} has no change`);
}

export function pathId(id: string): string {
  return encodeURIComponent(id);
}
