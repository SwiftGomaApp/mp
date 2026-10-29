import * as Network from "expo-network";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { useSession } from "@/core/auth/use-session";
import {
  hasInternet,
  isInternetAvailable,
  type ConnectivityStatus,
} from "@/core/network/connectivity";
import { checkServer } from "@/core/network/server-health";

import { SPLASH_ANIMATION_MS, SPLASH_HOLD_AFTER_ANIMATION_MS } from "../constants/splash.constants";

export type SplashScreen = "splash" | "offline" | "server-unreachable";

const AUTO_RETRY_COOLDOWN_MS = 5_000;
const SESSION_WAIT_MS = 8_000;

export function useSplashRedirect() {
  const router = useRouter();
  const [status, setStatus] = useState<ConnectivityStatus>("checking");
  const [animationDone, setAnimationDone] = useState(false);
  const [run, setRun] = useState(0);
  const session = useSession();
  const [sessionTimedOut, setSessionTimedOut] = useState(false);

  const statusRef = useRef<ConnectivityStatus>("checking");
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const internetRef = useRef(true);
  const lastAutoRetryRef = useRef(0);

  const retry = useCallback(() => {
    setStatus("checking");
    setAnimationDone(false);
    setRun((n) => n + 1);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSessionTimedOut(true), SESSION_WAIT_MS);
    return () => clearTimeout(timer);
  }, [run]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const internet = await hasInternet();
      internetRef.current = internet;
      if (!internet) {
        if (!cancelled) setStatus("offline");
        return;
      }
      const reachable = await checkServer();
      if (!cancelled) setStatus(reachable ? "online" : "server-unreachable");
    })();

    return () => {
      cancelled = true;
    };
  }, [run]);

  useEffect(() => {
    const subscription = Network.addNetworkStateListener((state) => {
      const available = isInternetAvailable(state);
      const regained = !internetRef.current && available;
      internetRef.current = available;

      const cooledDown = Date.now() - lastAutoRetryRef.current > AUTO_RETRY_COOLDOWN_MS;
      if (regained && statusRef.current === "offline" && cooledDown) {
        lastAutoRetryRef.current = Date.now();
        retry();
      }
    });
    return () => subscription.remove();
  }, [retry]);

  useEffect(() => {
    const timer = setTimeout(
      () => setAnimationDone(true),
      SPLASH_ANIMATION_MS + SPLASH_HOLD_AFTER_ANIMATION_MS,
    );
    return () => clearTimeout(timer);
  }, [run]);

  const sessionKnown = session.status !== "unknown" || sessionTimedOut;

  useEffect(() => {
    if (animationDone && status === "online" && sessionKnown) router.replace("/home");
  }, [animationDone, status, sessionKnown, router]);

  const screen: SplashScreen =
    animationDone && (status === "offline" || status === "server-unreachable") ? status : "splash";

  return { screen, run, retry };
}
