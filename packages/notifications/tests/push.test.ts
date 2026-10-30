import { describe, expect, it, vi } from "vitest";
import { createNotifications } from "../src/index";
import type { PushOpenEvent } from "../src/index";
import { createFakePushProvider } from "../src/testing/index";
import { fail, fakeAuth, ok } from "./helpers";
import type { Seen } from "./helpers";

const fakeProvider = () => createFakePushProvider({ subscriptionId: "sub-12345678" });

const server = ({ method, url }: { method: string; url: string }) => {
  if (method === "post" && url === "/notifications/devices") return ok({ id: "d1" });
  if (method === "delete") return ok({ removed: 1 });
  if (url.endsWith("/opened")) return ok({ id: "n1", recorded: true });
  return ok();
};

const registrations = (calls: Seen[]) =>
  calls.filter((c) => c.method === "post" && c.url === "/notifications/devices");

describe("push without a provider", () => {
  it("stays off and never touches the session", async () => {
    const { auth, calls } = fakeAuth(server);
    const notifications = createNotifications({ auth });
    notifications.start();

    expect(notifications.push.getState().status).toBe("disabled");
    expect((await notifications.push.enable()).status).toBe("disabled");
    expect((await notifications.push.requestPermission()).status).toBe("disabled");
    expect(calls).toHaveLength(0);
  });
});

describe("push with a provider", () => {
  it("registers the device when somebody is signed in", async () => {
    const provider = fakeProvider();
    const { auth, calls } = fakeAuth(server);
    const { push, start } = createNotifications({ auth, push: provider });
    start();
    await push.refresh();

    expect(push.getState()).toEqual({
      status: "enabled",
      subscriptionId: "sub-12345678",
      registered: true,
    });
    expect(provider.identifiedUser).toBe("user-1");
    expect(registrations(calls)[0]?.body).toEqual({
      subscriptionId: "sub-12345678",
      deviceId: "device-12345678",
      platform: "ANDROID",
    });
  });

  it("registers only once for the same subscription", async () => {
    const provider = fakeProvider();
    const { auth, calls } = fakeAuth(server);
    const { push, start } = createNotifications({ auth, push: provider });
    start();
    await push.refresh();
    await push.refresh();
    expect(registrations(calls)).toHaveLength(1);
  });

  it("waits for a question to be asked, then registers", async () => {
    const provider = fakeProvider();
    provider.permission = "undetermined";
    const { auth, calls } = fakeAuth(server);
    const { push, start } = createNotifications({ auth, push: provider });
    start();

    expect((await push.refresh()).status).toBe("permission-needed");
    expect(registrations(calls)).toHaveLength(0);

    expect((await push.requestPermission()).status).toBe("enabled");
    expect(registrations(calls)).toHaveLength(1);
  });

  it("reports a refusal and registers nothing", async () => {
    const provider = fakeProvider();
    provider.permission = "denied";
    const { auth, calls } = fakeAuth(server);
    const { push, start } = createNotifications({ auth, push: provider });
    start();

    expect((await push.refresh()).status).toBe("denied");
    expect(calls).toHaveLength(0);
  });

  it("becomes unavailable instead of crashing when the SDK cannot start", async () => {
    const provider = fakeProvider();
    provider.initError = new Error("native module missing");
    const onError = vi.fn();
    const { auth } = fakeAuth(server);
    const { push, start } = createNotifications({ auth, push: provider, onError });
    start();

    expect((await push.refresh()).status).toBe("unavailable");
    expect(onError).toHaveBeenCalledWith(provider.initError);
  });

  it("registers a new subscription when the SDK changes it", async () => {
    const provider = fakeProvider();
    const { auth, calls } = fakeAuth(server);
    const { push, start } = createNotifications({ auth, push: provider });
    start();
    await push.refresh();

    provider.changeSubscription("sub-87654321");
    await push.refresh();
    expect(registrations(calls).map((c) => c.body.subscriptionId)).toEqual([
      "sub-12345678",
      "sub-87654321",
    ]);
  });

  it("forgets the person on sign-out and registers again on the next sign-in", async () => {
    const provider = fakeProvider();
    const { auth, calls, signIn } = fakeAuth(server);
    const { push, start } = createNotifications({ auth, push: provider });
    start();
    await push.refresh();

    signIn(null);
    await push.refresh();
    expect(provider.identifiedUser).toBeNull();
    expect(push.getState()).toMatchObject({ status: "idle", registered: false });

    signIn("user-1");
    await push.refresh();
    expect(registrations(calls)).toHaveLength(2);
  });

  it("removes the device on disable and stays off until enabled again", async () => {
    const provider = fakeProvider();
    const { auth, calls } = fakeAuth(server);
    const { push, start } = createNotifications({ auth, push: provider });
    start();
    await push.refresh();

    expect((await push.disable()).status).toBe("disabled");
    expect(
      calls.some((c) => c.method === "delete" && c.url === "/notifications/devices/sub-12345678"),
    ).toBe(true);
    expect((await push.refresh()).status).toBe("disabled");

    expect((await push.enable()).status).toBe("enabled");
  });

  it("unregister removes the device but keeps push switched on", async () => {
    const provider = fakeProvider();
    const { auth, calls } = fakeAuth(server);
    const { push, start } = createNotifications({ auth, push: provider });
    start();
    await push.refresh();

    await push.unregister();
    expect(calls.some((c) => c.method === "delete")).toBe(true);
    expect(push.getState().status).toBe("idle");
    expect((await push.enable()).status).toBe("enabled");
  });

  it("can start switched off", async () => {
    const provider = fakeProvider();
    const { auth, calls } = fakeAuth(server);
    const { push, start } = createNotifications({ auth, push: provider, pushEnabled: false });
    start();
    expect((await push.refresh()).status).toBe("disabled");
    expect(calls).toHaveLength(0);
  });

  it("keeps going when the server refuses, and retries later", async () => {
    const provider = fakeProvider();
    let down = true;
    const onError = vi.fn();
    const { auth } = fakeAuth((seen) => (down ? fail(503, "SERVICE_UNAVAILABLE") : server(seen)));
    const { push, start } = createNotifications({ auth, push: provider, onError });
    start();

    expect((await push.refresh()).registered).toBe(false);
    expect(onError).toHaveBeenCalled();
    down = false;
    expect((await push.refresh()).registered).toBe(true);
  });

  it("tells the server about a tap and passes it on", async () => {
    const provider = fakeProvider();
    const { auth, calls } = fakeAuth(server);
    const { push, start } = createNotifications({ auth, push: provider });
    const heard: PushOpenEvent[] = [];
    push.onOpen((event) => heard.push(event));
    start();
    await push.refresh();

    provider.tap({ notificationId: "n1", type: "order.placed" });
    await vi.waitFor(() =>
      expect(calls.some((c) => c.url === "/notifications/n1/opened")).toBe(true),
    );
    expect(heard).toEqual([{ notificationId: "n1", type: "order.placed" }]);
  });

  it("does not call the server for a tap when nobody is signed in", async () => {
    const provider = fakeProvider();
    const { auth, calls, signIn } = fakeAuth(server);
    const { push, start } = createNotifications({ auth, push: provider });
    start();
    await push.refresh();
    signIn(null);

    provider.tap({ notificationId: "n1", type: "order.placed" });
    expect(calls.some((c) => c.url.endsWith("/opened"))).toBe(false);
  });
});
