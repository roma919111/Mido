import { useEffect, useRef } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { consumePendingReturnHome } from "../lib/app-navigation";

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
    function tryReturnHome() {
      if (consumePendingReturnHome()) {
        onReturnHomeRef.current();
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        tryReturnHome();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", tryReturnHome);
    window.addEventListener("pageshow", tryReturnHome);

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
        if (isActive) tryReturnHome();
      }).then((handle) => {
        appStateListener = handle;
      });

      void App.addListener("resume", () => {
        tryReturnHome();
      }).then((handle) => {
        resumeListener = handle;
      });

      void App.addListener("backButton", () => {
        if (onBackStepRef.current()) return;
        onReturnHomeRef.current();
      }).then((handle) => {
        backListener = handle;
      });
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", tryReturnHome);
      window.removeEventListener("pageshow", tryReturnHome);
      window.removeEventListener("popstate", popHandler);
      appStateListener?.remove();
      backListener?.remove();
      resumeListener?.remove();
    };
  }, []);
}

export function pushOverlayHistory() {
  window.history.pushState({ streamHubOverlay: true }, "", window.location.href);
}
