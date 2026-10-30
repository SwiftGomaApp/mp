import { describe, expect, it } from "vitest";
import { ApiError } from "swiftgoma-mp-auth";
import { createNotifications } from "../src/index";
import { fail, fakeAuth, ok } from "./helpers";

const settings = {
  timezone: "Africa/Lubumbashi",
  quietHoursEnabled: false,
  quietHoursStart: null,
  quietHoursEnd: null,
  marketingEmailOptIn: false,
};
const categories = [
  {
    context: "SALE",
    label: "Mes ventes",
    locked: false,
    hasMandatory: false,
    channels: [{ channel: "IN_APP", locked: true, enabled: true }],
  },
];

describe("preferences", () => {
  it("reads categories and settings", async () => {
    const { auth, calls } = fakeAuth(() => ok({ categories, settings }));
    expect(await createNotifications({ auth }).preferences.get()).toEqual({ categories, settings });
    expect(calls[0]).toMatchObject({ method: "get", url: "/notifications/preferences" });
  });

  it("sends the changes as the server expects them", async () => {
    const { auth, calls } = fakeAuth(() => ok({ categories, settings }));
    await createNotifications({ auth }).preferences.update([
      { context: "SALE", channel: "SMS", enabled: false },
    ]);
    expect(calls[0]).toMatchObject({ method: "patch", url: "/notifications/preferences" });
    expect(calls[0]?.body).toEqual({
      preferences: [{ context: "SALE", channel: "SMS", enabled: false }],
    });
  });

  it("refuses an empty or oversized batch", async () => {
    const { auth, calls } = fakeAuth(() => ok());
    const { preferences } = createNotifications({ auth });
    const change = { context: "SALE", channel: "SMS", enabled: false } as const;

    await expect(preferences.update([])).rejects.toThrow(TypeError);
    await expect(preferences.update(Array.from({ length: 31 }, () => change))).rejects.toThrow(
      TypeError,
    );
    expect(calls).toHaveLength(0);
  });

  it("surfaces a locked preference", async () => {
    const { auth } = fakeAuth(() => fail(403, "PREFERENCE_LOCKED"));
    const error = await createNotifications({ auth })
      .preferences.update([{ context: "SECURITY", channel: "SMS", enabled: false }])
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ code: "PREFERENCE_LOCKED", status: 403 });
  });

  it("updates the settings and refuses an empty change", async () => {
    const { auth, calls } = fakeAuth(() => ok({ ...settings, quietHoursEnabled: true }));
    const { preferences } = createNotifications({ auth });

    const next = await preferences.updateSettings({ quietHoursEnabled: true });
    expect(next.quietHoursEnabled).toBe(true);
    expect(calls[0]).toMatchObject({ method: "patch", url: "/notifications/settings" });
    await expect(preferences.updateSettings({})).rejects.toThrow(TypeError);
  });
});

describe("catalog", () => {
  it("lists the events of the role", async () => {
    const events = [
      {
        type: "order.placed",
        context: "PURCHASE",
        priority: "NORMAL",
        mandatory: false,
        channels: ["IN_APP"],
        escalation: null,
      },
    ];
    const { auth, calls } = fakeAuth(() => ok({ events }));
    expect(await createNotifications({ auth }).catalog.list()).toEqual(events);
    expect(calls[0]?.url).toBe("/notifications/catalog");
  });
});

describe("devices", () => {
  const input = {
    subscriptionId: "sub-12345678",
    deviceId: "device-12345678",
    platform: "ANDROID",
  } as const;

  it("registers and removes a subscription", async () => {
    const { auth, calls } = fakeAuth(({ method }) =>
      method === "post" ? ok({ id: "d1" }) : ok({ removed: 1 }),
    );
    const { devices } = createNotifications({ auth });

    expect(await devices.register(input)).toEqual({ id: "d1" });
    expect(await devices.remove("sub-12345678")).toEqual({ removed: 1 });
    expect(calls[0]).toMatchObject({ method: "post", url: "/notifications/devices" });
    expect(calls[0]?.body).toEqual(input);
    expect(calls[1]).toMatchObject({
      method: "delete",
      url: "/notifications/devices/sub-12345678",
    });
  });

  it("refuses ids and platforms the server would refuse", async () => {
    const { auth, calls } = fakeAuth(() => ok());
    const { devices } = createNotifications({ auth });

    await expect(devices.register({ ...input, subscriptionId: "short" })).rejects.toThrow(
      TypeError,
    );
    await expect(devices.register({ ...input, deviceId: "x".repeat(129) })).rejects.toThrow(
      TypeError,
    );
    await expect(devices.register({ ...input, platform: "WINDOWS" as never })).rejects.toThrow(
      TypeError,
    );
    await expect(devices.remove("short")).rejects.toThrow(TypeError);
    expect(calls).toHaveLength(0);
  });

  it("throws an ApiError when the server refuses", async () => {
    const { auth } = fakeAuth(() => fail(401, "UNAUTHORIZED"));
    await expect(createNotifications({ auth }).devices.register(input)).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});

describe("createNotifications", () => {
  it("requires an auth object", () => {
    expect(() => createNotifications({} as never)).toThrow(TypeError);
  });
});
