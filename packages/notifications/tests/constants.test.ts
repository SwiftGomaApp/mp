import { describe, expect, it } from "vitest";
import {
  CONTEXTS,
  EVENT_CATALOG,
  EVENT_TYPES,
  INBOX_PAGE_SIZE_DEFAULT,
  INBOX_PAGE_SIZE_MAX,
  PREFERENCE_CHANNELS,
  SOCKET_ERROR_CODES,
  SOCKET_EVENTS,
  SOCKET_FATAL_ERROR_CODES,
  isEventType,
} from "../src/index";

describe("constants", () => {
  it("keeps the inbox page bounds the server enforces", () => {
    expect(INBOX_PAGE_SIZE_DEFAULT).toBe(20);
    expect(INBOX_PAGE_SIZE_MAX).toBe(50);
  });

  it("never lets a person switch off the in-app channel", () => {
    expect([...PREFERENCE_CHANNELS]).toEqual(["PUSH", "SMS", "EMAIL"]);
  });

  it("names the socket events the server emits and accepts", () => {
    expect(SOCKET_EVENTS.notificationNew).toBe("notification:new");
    expect(SOCKET_EVENTS.authRefresh).toBe("auth:refresh");
  });

  it("only treats known socket errors as fatal", () => {
    for (const code of SOCKET_FATAL_ERROR_CODES) expect(SOCKET_ERROR_CODES).toContain(code);
    expect(SOCKET_FATAL_ERROR_CODES).not.toContain("UNAVAILABLE");
    expect(SOCKET_FATAL_ERROR_CODES).not.toContain("TOKEN_EXPIRED");
  });
});

describe("event catalogue", () => {
  it("describes every event type once", () => {
    expect(new Set(EVENT_TYPES).size).toBe(EVENT_TYPES.length);
    expect(Object.keys(EVENT_CATALOG).sort()).toEqual([...EVENT_TYPES].sort());
  });

  it("uses only known contexts", () => {
    for (const info of Object.values(EVENT_CATALOG)) expect(CONTEXTS).toContain(info.context);
  });

  it("recognises event types", () => {
    expect(isEventType("sale.order.new")).toBe(true);
    expect(isEventType("sale.order.old")).toBe(false);
    expect(isEventType(42)).toBe(false);
  });
});
