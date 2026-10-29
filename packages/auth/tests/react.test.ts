// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAuth, createMemoryStorage } from "../src/index";
import type { Auth } from "../src/index";
import { AuthProvider, useAuth, useCurrentUser, useSession } from "../src/react/index";
import { createFakeAuthServer, createTestAdapter } from "../src/testing/index";

afterEach(cleanup);

function setup() {
  const server = createFakeAuthServer();
  server.addUser({ name: "Gael", email: "gael@example.com", password: "secret123" });
  const auth = createAuth({
    baseUrl: "https://api.example.com",
    adapter: createTestAdapter("ANDROID", createMemoryStorage()),
    transport: server.transport,
  });
  return { auth, server };
}

function Probe() {
  const session = useSession();
  const user = useCurrentUser();
  return createElement("div", { "data-testid": "out" }, `${session.status}:${user?.name ?? "-"}`);
}

const renderWith = (auth: Auth, props: object = {}) =>
  render(createElement(AuthProvider, { auth, ...props }, createElement(Probe)));

const out = () => screen.getByTestId("out").textContent;

describe("AuthProvider", () => {
  it("starts the session when it mounts", async () => {
    const { auth } = setup();
    const start = vi.spyOn(auth, "start");
    renderWith(auth);

    expect(out()).toBe("unknown:-");
    await waitFor(() => expect(out()).toBe("anonymous:-"));
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("follows the session as the user signs in and out", async () => {
    const { auth } = setup();
    renderWith(auth);
    await waitFor(() => expect(out()).toBe("anonymous:-"));

    await act(async () => {
      await auth.login.password({ email: "gael@example.com", password: "secret123" });
    });
    expect(out()).toBe("authenticated:Gael");

    await act(async () => {
      await auth.logout();
    });
    expect(out()).toBe("anonymous:-");
  });

  it("stops the session when it unmounts", async () => {
    const { auth } = setup();
    const stop = vi.spyOn(auth, "stop");
    const view = renderWith(auth);
    await waitFor(() => expect(out()).toBe("anonymous:-"));

    view.unmount();
    expect(stop).toHaveBeenCalled();
  });

  it("survives React strict mode, which mounts twice", async () => {
    const { auth } = setup();
    render(
      createElement(StrictMode, null, createElement(AuthProvider, { auth }, createElement(Probe))),
    );
    await waitFor(() => expect(out()).toBe("anonymous:-"));

    await act(async () => {
      await auth.login.password({ email: "gael@example.com", password: "secret123" });
    });
    expect(out()).toBe("authenticated:Gael");
  });

  it("reports a session that could not be read", async () => {
    const { auth } = setup();
    vi.spyOn(auth, "start").mockRejectedValue(new Error("keychain locked"));
    const onStartError = vi.fn();
    renderWith(auth, { onStartError });

    await waitFor(() => expect(onStartError).toHaveBeenCalledTimes(1));
    expect(onStartError.mock.calls[0]?.[0]).toMatchObject({ message: "keychain locked" });
  });
});

describe("hooks", () => {
  it("useAuth gives the Auth object", () => {
    const { auth } = setup();
    let seen: Auth | null = null;
    function Grab() {
      seen = useAuth();
      return null;
    }
    render(createElement(AuthProvider, { auth }, createElement(Grab)));
    expect(seen).toBe(auth);
  });

  it("refuse to work outside the provider", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(createElement(Probe))).toThrow(/AuthProvider/);
    quiet.mockRestore();
  });
});
