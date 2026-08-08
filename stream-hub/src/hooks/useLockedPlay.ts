import { useCallback } from "react";
import type { PlatformId } from "../types";
import { openPlatformLocked } from "../lib/platform-open";
import { resolvePlatformDeepLinkSync } from "../lib/platform-deeplink";
import { pushRecentItem, type TmdbDiscoverItem } from "../lib/tmdb-discover";

function reportPlayError(message: string): void {
  window.dispatchEvent(new CustomEvent("max-play-error", { detail: message }));
}

export function useLockedPlay(defaultPlatform: PlatformId = "netflix") {
  const play = useCallback((item: TmdbDiscoverItem, platform: PlatformId = defaultPlatform) => {
    pushRecentItem(item);

    const link = resolvePlatformDeepLinkSync(
      item.tmdbId,
      item.tmdbType,
      platform,
      item.title,
      item.year,
    );

    void openPlatformLocked(platform, {
      url: link.url ?? undefined,
      searchQuery: link.url ? undefined : link.searchQuery,
    }).then((result) => {
      if (result === "failed") {
        reportPlayError("تعذر فتح التطبيق — ثبّت Netflix أو جرّب مرة أخرى");
      }
    });
  }, [defaultPlatform]);

  const openApp = useCallback((platform: PlatformId = defaultPlatform) => {
    void openPlatformLocked(platform).then((result) => {
      if (result === "failed") {
        reportPlayError("تعذر فتح التطبيق");
      }
    });
  }, [defaultPlatform]);

  return { play, openApp };
}
