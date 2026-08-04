import { useEffect, useRef } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { consumePendingReturnHome, hasPendingReturnHome } from "../lib/app-navigation";

type UseReturnToHomeOptions = {
  onReturnHome: () => void;
  onBackStep: () => boolean;
  /** Block auto-return while popcorn / launch is in progress */
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
    let wasAway = false;

    function returnHomeNow() {
      if (isPlaybackActiveRef.current?.()) return;
      if (!hasPendingReturnHome()) return;
      consumePendingReturnHome();
      onReturnHomeRef.current();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        wasAway = true;
        return;
      }
      if (document.visibilityState === "visible" && wasAway) {
        wasAway = false;
        window.setTimeout(returnHomeNow, 250);
      }
    }

    function onWindowBlur() {
      wasAway = true;
    }

    function onWindowFocus() {
      if (!wasAway) return;
      wasAway = false;
      window.setTimeout(returnHomeNow, 250);
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("focus", onWindowFocus);

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
        if (isActive) {
          wasAway = true;
          window.setTimeout(returnHomeNow, 250);
        }
      }).then((handle) => {
        appStateListener = handle;
      });

      void App.addListener("resume", () => {
        wasAway = true;
        window.setTimeout(returnHomeNow, 250);
      }).then((handle) => {
        resumeListener = handle;
      });

      void App.addListener("backButton", () => {
        if (onBackStepRef.current()) return;
        returnHomeNow();
      }).then((handle) => {
        backListener = handle;
      });
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("focus", onWindowFocus);
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
