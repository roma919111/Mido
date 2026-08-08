import { useCallback } from "react";
import type { PlatformId } from "../types";
import { openPlatformLocked } from "../lib/platform-open";
import { resolvePlatformDeepLink } from "../lib/platform-deeplink";
import { pushRecentItem, type TmdbDiscoverItem } from "../lib/tmdb-discover";

function reportPlayError(message: string): void {
  window.dispatchEvent(new CustomEvent("max-play-error", { detail: message }));
}

export function useLockedPlay(defaultPlatform: PlatformId = "netflix") {
  const play = useCallback((item: TmdbDiscoverItem, platform: PlatformId = defaultPlatform) => {
    pushRecentItem(item);

    void (async () => {
      const link = await resolvePlatformDeepLink(
        item.tmdbId,
        item.tmdbType,
        platform,
        item.title,
        item.year,
      );

      const result = await openPlatformLocked(platform, {
        url: link.url ?? undefined,
        searchQuery: link.url ? undefined : link.searchQuery,
        tmdbId: item.tmdbId,
        tmdbType: item.tmdbType,
      });

      if (result === "failed") {
        reportPlayError("تعذر فتح Netflix — جرّب مرة أخرى");
      }
    })();
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
