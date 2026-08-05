import { useEffect, useRef } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { clearAllReturnFlags, wasPlatformOpened } from "../lib/app-navigation";
import { onPlatformBrowserClosed } from "../lib/platform-browser";

type UseReturnToHomeOptions = {
  onReturnHome: () => void;
  onWelcomeBack: () => void;
  onBackStep: () => boolean;
  isPlaybackActive?: () => boolean;
};

export function useReturnToHome({
  onReturnHome,
  onWelcomeBack,
  onBackStep,
  isPlaybackActive,
}: UseReturnToHomeOptions) {
  const onReturnHomeRef = useRef(onReturnHome);
  const onWelcomeBackRef = useRef(onWelcomeBack);
  const onBackStepRef = useRef(onBackStep);
  const isPlaybackActiveRef = useRef(isPlaybackActive);
  onReturnHomeRef.current = onReturnHome;
  onWelcomeBackRef.current = onWelcomeBack;
  onBackStepRef.current = onBackStep;
  isPlaybackActiveRef.current = isPlaybackActive;

  useEffect(() => {
    let wasHidden = false;

    function handlePlatformReturn() {
      if (isPlaybackActiveRef.current?.()) return;
      if (!wasPlatformOpened()) return;
      clearAllReturnFlags();
      onReturnHomeRef.current();
      onWelcomeBackRef.current();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        if (wasPlatformOpened()) wasHidden = true;
        return;
      }
      if (document.visibilityState === "visible" && wasHidden) {
        wasHidden = false;
        window.setTimeout(handlePlatformReturn, 250);
      }
    }

    function onWindowFocus() {
      if (!wasPlatformOpened()) return;
      window.setTimeout(handlePlatformReturn, 250);
    }

    function onPopState() {
      onBackStepRef.current();
    }

    function onPageShow(event: PageTransitionEvent) {
      if (!event.persisted) return;
      if (isPlaybackActiveRef.current?.()) return;
      if (!wasPlatformOpened()) return;
      window.setTimeout(handlePlatformReturn, 250);
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onWindowFocus);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("pageshow", onPageShow);

    const removeBrowserListener = onPlatformBrowserClosed(() => {
      window.setTimeout(handlePlatformReturn, 150);
    });

    let appStateListener: { remove: () => void } | undefined;
    let backListener: { remove: () => void } | undefined;

    if (Capacitor.isNativePlatform()) {
      void App.addListener("appStateChange", ({ isActive }) => {
        if (isActive && wasPlatformOpened()) {
          window.setTimeout(handlePlatformReturn, 250);
        }
      }).then((handle) => {
        appStateListener = handle;
      });

      void App.addListener("backButton", () => {
        if (onBackStepRef.current()) return;
        if (wasPlatformOpened()) {
          handlePlatformReturn();
          return;
        }
        onReturnHomeRef.current();
      }).then((handle) => {
        backListener = handle;
      });
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onWindowFocus);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pageshow", onPageShow);
      removeBrowserListener();
      appStateListener?.remove();
      backListener?.remove();
    };
  }, []);
}

export function pushOverlayHistory() {
  window.history.pushState({ streamHubOverlay: true }, "", window.location.href);
}
