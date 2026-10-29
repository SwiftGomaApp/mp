import { describe, expect, it, vi } from "vitest";
import { createNativeAdapter, watchAppForeground } from "../src/native/index";
import type { AppStateLike } from "../src/native/index";
import { createWebAdapter, watchBrowserForeground } from "../src/web/index";
import { createMemoryStorage } from "../src/index";

function fakeTarget() {
  const listeners = new Map<string, Set<() => void>>();
  return {
    visibilityState: "visible" as string,
    addEventListener: (type: string, listener: () => void) => {
      listeners.set(type, (listeners.get(type) ?? new Set()).add(listener));
    },
    removeEventListener: (type: string, listener: () => void) => {
      listeners.get(type)?.delete(listener);
    },
    emit: (type: string) => listeners.get(type)?.forEach((listener) => listener()),
    count: (type: string) => listeners.get(type)?.size ?? 0,
  };
}

describe("watchBrowserForeground", () => {
  it("fires when the tab becomes visible, not when it is hidden", () => {
    const doc = fakeTarget();
    const listener = vi.fn();
    watchBrowserForeground(listener, { document: doc, window: fakeTarget() });

    doc.visibilityState = "hidden";
    doc.emit("visibilitychange");
    expect(listener).not.toHaveBeenCalled();

    doc.visibilityState = "visible";
    doc.emit("visibilitychange");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("fires when the browser goes back online", () => {
    const win = fakeTarget();
    const listener = vi.fn();
    watchBrowserForeground(listener, { document: fakeTarget(), window: win });
    win.emit("online");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stops listening", () => {
    const doc = fakeTarget();
    const win = fakeTarget();
    const listener = vi.fn();
    const stop = watchBrowserForeground(listener, { document: doc, window: win });
    stop();
    doc.emit("visibilitychange");
    win.emit("online");
    expect(listener).not.toHaveBeenCalled();
    expect(doc.count("visibilitychange")).toBe(0);
  });

  it("does nothing outside a browser", () => {
    const stop = watchBrowserForeground(vi.fn(), {});
    expect(() => stop()).not.toThrow();
  });

  it("is part of the web adapter", () => {
    const adapter = createWebAdapter({ storage: createMemoryStorage() });
    const stop = adapter.onForeground?.(vi.fn());
    expect(typeof stop).toBe("function");
    stop?.();
  });
});

describe("watchAppForeground", () => {
  function fakeAppState() {
    let handler: (state: string) => void = () => undefined;
    const remove = vi.fn();
    const appState: AppStateLike = {
      addEventListener: (_type, listener) => {
        handler = listener;
        return { remove };
      },
    };
    return { appState, change: (state: string) => handler(state), remove };
  }

  it("fires only when the app becomes active", () => {
    const { appState, change } = fakeAppState();
    const listener = vi.fn();
    watchAppForeground(appState, listener);

    change("background");
    change("inactive");
    expect(listener).not.toHaveBeenCalled();
    change("active");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stops listening", () => {
    const { appState, remove } = fakeAppState();
    watchAppForeground(appState, vi.fn())();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("is part of the native adapter when the app passes its AppState", () => {
    const secureStore = {
      getItemAsync: () => Promise.resolve(null),
      setItemAsync: () => Promise.resolve(),
      deleteItemAsync: () => Promise.resolve(),
    };
    const { appState, change } = fakeAppState();
    const listener = vi.fn();

    expect(createNativeAdapter({ os: "ios", secureStore }).onForeground).toBeUndefined();
    createNativeAdapter({ os: "ios", secureStore, appState }).onForeground?.(listener);
    change("active");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
