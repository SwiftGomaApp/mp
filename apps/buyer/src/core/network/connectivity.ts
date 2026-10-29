import * as Network from "expo-network";

export type ConnectivityStatus = "checking" | "online" | "offline" | "server-unreachable";

export function isInternetAvailable(state: Network.NetworkState): boolean {
  return state.isInternetReachable ?? state.isConnected ?? true;
}

export async function hasInternet(): Promise<boolean> {
  try {
    return isInternetAvailable(await Network.getNetworkStateAsync());
  } catch {
    return true;
  }
}
