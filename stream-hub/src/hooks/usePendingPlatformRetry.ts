import { useEffect, useRef } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { retryPendingPlatformPlay } from "../lib/platform-smart-launch";

type UsePendingPlatformRetryOptions = {
  onOpenedApp: (url: string) => void;
  onStillPending: () => void;
};

export function usePendingPlatformRetry({ onOpenedApp, onStillPending }: UsePendingPlatformRetryOptions) {
  const onOpenedRef = useRef(onOpenedApp);
  const onPendingRef = useRef(onStillPending);
  onOpenedRef.current = onOpenedApp;
  onPendingRef.current = onStillPending;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    async function tryRetry() {
      const result = await retryPendingPlatformPlay();
      if (result?.action === "opened-app") {
        onOpenedRef.current(result.url);
      }
    }

    function onResume() {
      window.setTimeout(() => void tryRetry(), 400);
    }

    let appListener: { remove: () => void } | undefined;

    void App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) onResume();
    }).then((handle) => {
      appListener = handle;
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onResume();
    });

    return () => {
      appListener?.remove();
    };
  }, []);

  return {
    retryNow: async () => {
      const result = await retryPendingPlatformPlay();
      if (result?.action === "opened-app") {
        onOpenedRef.current(result.url);
        return true;
      }
      onPendingRef.current();
      return false;
    },
  };
}
