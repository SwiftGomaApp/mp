import AsyncStorage from "@react-native-async-storage/async-storage";

const SEEN_KEY = "swiftgoma.onboarding.seen";

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SEEN_KEY)) === "1";
  } catch {
    return true;
  }
}

export async function markOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Worst case the welcome screen shows once more.
  }
}

export async function resetOnboarding(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SEEN_KEY);
  } catch {
    // ignore
  }
}
