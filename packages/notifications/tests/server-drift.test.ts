/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CHANNELS,
  CONTEXTS,
  EVENT_CATALOG,
  EVENT_TYPES,
  PLATFORMS,
  PRIORITIES,
} from "../src/index";

const SERVER_ROOT =
  process.env.SERVER_ROOT ?? fileURLToPath(new URL("../../../server", import.meta.url));
const EVENTS_FILE = join(SERVER_ROOT, "src/features/notifications/config/events.config.js");
const SCHEMA_FILE = join(SERVER_ROOT, "prisma/schema.prisma");

interface ServerEvent {
  key: string;
  context: string;
  priority: string;
  mandatory: boolean;
  channels: string[];
  roles?: string[];
  escalation?: { afterMinutes: number; channel: string };
}

function prismaEnum(name: string): string[] {
  const text = readFileSync(SCHEMA_FILE, "utf8");
  const body = text.match(new RegExp(`enum ${name} \\{([^}]*)\\}`))?.[1] ?? "";
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//"));
}

describe.skipIf(!existsSync(EVENTS_FILE) || !existsSync(SCHEMA_FILE))(
  "server notifications",
  () => {
    const require = createRequire(import.meta.url);
    const { EVENTS } = require(EVENTS_FILE) as { EVENTS: Record<string, ServerEvent> };

    it("finds the events in the server source", () => {
      expect(Object.keys(EVENTS).length).toBeGreaterThan(20);
    });

    it("lists every event type the server can create", () => {
      const missing = Object.keys(EVENTS).filter(
        (key) => !(EVENT_TYPES as readonly string[]).includes(key),
      );
      expect(missing, "add these to EVENT_TYPES and EVENT_CATALOG in src/core/events.ts").toEqual(
        [],
      );
    });

    it("no longer lists an event the server dropped", () => {
      const stale = EVENT_TYPES.filter((type) => !(type in EVENTS));
      expect(stale, "remove these from src/core/events.ts").toEqual([]);
    });

    it("describes each event the way the server does", () => {
      for (const type of EVENT_TYPES) {
        const server = EVENTS[type];
        const info = EVENT_CATALOG[type];
        expect(server, type).toBeDefined();
        if (!server) continue;
        expect(info.context, `${type} context`).toBe(server.context);
        expect(info.priority, `${type} priority`).toBe(server.priority);
        expect(info.mandatory, `${type} mandatory`).toBe(server.mandatory);
        expect(info.roles, `${type} roles`).toEqual(server.roles ?? null);
        expect(info.channels, `${type} channels`).toEqual(server.channels);
        expect(info.escalation, `${type} escalation`).toEqual(server.escalation ?? null);
      }
    });

    it("uses the same enums as the database", () => {
      expect([...CONTEXTS]).toEqual(prismaEnum("NotificationContext"));
      expect([...PRIORITIES]).toEqual(prismaEnum("NotificationPriority"));
      expect([...CHANNELS]).toEqual(prismaEnum("NotificationChannel"));
      expect([...PLATFORMS]).toEqual(prismaEnum("DevicePlatform"));
    });
  },
);
