import { useEffect, useRef } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { clearAllReturnFlags, wasPlatformOpened } from "../lib/app-navigation";

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
    let wasHidden = false;

    function tryReturnHome() {
      if (isPlaybackActiveRef.current?.()) return;
      if (!wasPlatformOpened()) return;
      clearAllReturnFlags();
      onReturnHomeRef.current();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        if (wasPlatformOpened()) wasHidden = true;
        return;
      }
      if (document.visibilityState === "visible" && wasHidden) {
        wasHidden = false;
        window.setTimeout(tryReturnHome, 250);
      }
    }

    function onPopState() {
      onBackStepRef.current();
    }

    function onPageShow(event: PageTransitionEvent) {
      if (!event.persisted) return;
      if (isPlaybackActiveRef.current?.()) return;
      if (!wasPlatformOpened()) return;
      clearAllReturnFlags();
      onReturnHomeRef.current();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("pageshow", onPageShow);

    let appStateListener: { remove: () => void } | undefined;
    let backListener: { remove: () => void } | undefined;

    if (Capacitor.isNativePlatform()) {
      void App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) window.setTimeout(tryReturnHome, 250);
      }).then((handle) => {
        appStateListener = handle;
      });

      void App.addListener("backButton", () => {
        if (onBackStepRef.current()) return;
        tryReturnHome();
      }).then((handle) => {
        backListener = handle;
      });
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pageshow", onPageShow);
      appStateListener?.remove();
      backListener?.remove();
    };
  }, []);
}

export function pushOverlayHistory() {
  window.history.pushState({ streamHubOverlay: true }, "", window.location.href);
}
