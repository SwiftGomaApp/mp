export interface AppStateLike {
  addEventListener(type: "change", listener: (state: string) => void): { remove(): void };
}

export function watchAppForeground(appState: AppStateLike, listener: () => void): () => void {
  const subscription = appState.addEventListener("change", (state) => {
    if (state === "active") listener();
  });
  return () => subscription.remove();
}
