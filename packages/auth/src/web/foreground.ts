export interface EventTargetLike {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export interface ForegroundTargets {
  document?: EventTargetLike & { visibilityState?: string };
  window?: EventTargetLike;
}

function browserTargets(): ForegroundTargets {
  return {
    document: typeof document === "undefined" ? undefined : document,
    window: typeof window === "undefined" ? undefined : window,
  };
}

export function watchBrowserForeground(
  listener: () => void,
  targets: ForegroundTargets = browserTargets(),
): () => void {
  const { document: doc, window: win } = targets;
  const onVisibility = (): void => {
    if (doc?.visibilityState !== "hidden") listener();
  };

  doc?.addEventListener("visibilitychange", onVisibility);
  win?.addEventListener("online", listener);

  return () => {
    doc?.removeEventListener("visibilitychange", onVisibility);
    win?.removeEventListener("online", listener);
  };
}
