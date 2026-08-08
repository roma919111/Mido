import { useCallback } from "react";
import type { PlatformId } from "../types";
import { enterKioskMode } from "../lib/kiosk-mode";
import { enterPlaybackMode } from "../lib/fullscreen";
import { openPlatformLocked } from "../lib/platform-open";
import { platformSearchUrl, pushRecentItem, type TmdbDiscoverItem } from "../lib/tmdb-discover";

export function useLockedPlay(defaultPlatform: PlatformId = "netflix") {
  const play = useCallback(async (item: TmdbDiscoverItem, platform: PlatformId = defaultPlatform) => {
    enterPlaybackMode();
    await enterKioskMode();
    pushRecentItem(item);
    await openPlatformLocked(platform, platformSearchUrl(platform, item.title));
  }, [defaultPlatform]);

  const openApp = useCallback(async (platform: PlatformId = defaultPlatform) => {
    enterPlaybackMode();
    await enterKioskMode();
    await openPlatformLocked(platform);
  }, [defaultPlatform]);

  return { play, openApp };
}
