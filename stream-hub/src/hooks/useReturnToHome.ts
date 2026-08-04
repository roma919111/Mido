import { useEffect, useRef } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { consumePendingReturnHome, hasPendingReturnHome } from "../lib/app-navigation";

type UseReturnToHomeOptions = {
  onReturnHome: () => void;
  onBackStep: () => boolean;
  isPlaybackActive?: () => boolean;
};

export function useReturnToHome({ onReturnHome, onBackStep, isPlaybackActive }: UseReturnToHomeOptions) {
  const onReturnHomeRef = useRef(onReturnHome);
  const onBackStepRef = useRef(onBackStep);
  const isPlaybackActiveRef = useRef(isPlaybackActive);
  onReturnHomeRef.current = onReturnHome;
  onBackStepRef.current = onBackStep;
  isPlaybackActiveRef.current = isPlaybackActive;

  useEffect(() => {
    let leftForPlatform = false;

    function softReturnHome() {
      if (isPlaybackActiveRef.current?.()) return;
      if (!hasPendingReturnHome()) return;
      consumePendingReturnHome();
      onReturnHomeRef.current();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        if (hasPendingReturnHome()) leftForPlatform = true;
        return;
      }
      if (document.visibilityState === "visible" && leftForPlatform) {
        leftForPlatform = false;
        window.setTimeout(softReturnHome, 300);
      }
    }

    function onPopState() {
      onBackStepRef.current();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("popstate", onPopState);

    let appStateListener: { remove: () => void } | undefined;
    let backListener: { remove: () => void } | undefined;

    if (Capacitor.isNativePlatform()) {
      void App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) window.setTimeout(softReturnHome, 300);
      }).then((handle) => {
        appStateListener = handle;
      });

      void App.addListener("backButton", () => {
        if (onBackStepRef.current()) return;
        softReturnHome();
      }).then((handle) => {
        backListener = handle;
      });
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("popstate", onPopState);
      appStateListener?.remove();
      backListener?.remove();
    };
  }, []);
}

export function pushOverlayHistory() {
  window.history.pushState({ streamHubOverlay: true }, "", window.location.href);
}
