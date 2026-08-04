import { useEffect, useRef } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { consumePendingReturnHome, hasPendingReturnHome } from "../lib/app-navigation";

type UseReturnToHomeOptions = {
  onReturnHome: () => void;
  onBackStep: () => boolean;
};

export function useReturnToHome({ onReturnHome, onBackStep }: UseReturnToHomeOptions) {
  const onReturnHomeRef = useRef(onReturnHome);
  const onBackStepRef = useRef(onBackStep);
  onReturnHomeRef.current = onReturnHome;
  onBackStepRef.current = onBackStep;

  useEffect(() => {
    function returnHomeNow() {
      if (!hasPendingReturnHome()) return;
      consumePendingReturnHome();
      onReturnHomeRef.current();
    }

    function onVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      window.setTimeout(returnHomeNow, 200);
    }

    function onWindowFocus() {
      window.setTimeout(returnHomeNow, 200);
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onWindowFocus);
    window.addEventListener("pageshow", onWindowFocus);

    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible" && document.hasFocus() && hasPendingReturnHome()) {
        returnHomeNow();
      }
    }, 800);

    const popHandler = () => {
      if (!onBackStepRef.current()) {
        onReturnHomeRef.current();
      }
    };
    window.addEventListener("popstate", popHandler);

    let appStateListener: { remove: () => void } | undefined;
    let backListener: { remove: () => void } | undefined;
    let resumeListener: { remove: () => void } | undefined;

    if (Capacitor.isNativePlatform()) {
      void App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) window.setTimeout(returnHomeNow, 200);
      }).then((handle) => {
        appStateListener = handle;
      });

      void App.addListener("resume", () => {
        window.setTimeout(returnHomeNow, 200);
      }).then((handle) => {
        resumeListener = handle;
      });

      void App.addListener("backButton", () => {
        if (onBackStepRef.current()) return;
        returnHomeNow();
        onReturnHomeRef.current();
      }).then((handle) => {
        backListener = handle;
      });
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onWindowFocus);
      window.removeEventListener("pageshow", onWindowFocus);
      window.removeEventListener("popstate", popHandler);
      window.clearInterval(poll);
      appStateListener?.remove();
      backListener?.remove();
      resumeListener?.remove();
    };
  }, []);
}

export function pushOverlayHistory() {
  window.history.pushState({ streamHubOverlay: true }, "", window.location.href);
}
