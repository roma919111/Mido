import { useCallback } from "react";
import type { PlatformId } from "../types";
import { openPlatformLocked } from "../lib/platform-open";
import { resolvePlatformDeepLink } from "../lib/platform-deeplink";
import { pushRecentItem, type TmdbDiscoverItem } from "../lib/tmdb-discover";
import { PLATFORMS } from "../lib/platforms";

function reportPlayError(message: string): void {
  window.dispatchEvent(new CustomEvent("max-play-error", { detail: message }));
}

function resolveItemPlatform(item: TmdbDiscoverItem, override?: PlatformId): PlatformId {
  return item.platform ?? override ?? "netflix";
}

export function useLockedPlay(defaultPlatform: PlatformId = "netflix") {
  const play = useCallback((item: TmdbDiscoverItem, platform?: PlatformId) => {
    const targetPlatform = resolveItemPlatform(item, platform ?? defaultPlatform);
    pushRecentItem({ ...item, platform: targetPlatform });

    void (async () => {
      const link = await resolvePlatformDeepLink(
        item.tmdbId,
        item.tmdbType,
        targetPlatform,
        item.title,
        item.year,
      );

      const result = await openPlatformLocked(targetPlatform, {
        url: link.url ?? undefined,
        searchQuery: link.url ? undefined : link.searchQuery,
        tmdbId: item.tmdbId,
        tmdbType: item.tmdbType,
      });

      if (result === "failed") {
        reportPlayError(`تعذر فتح ${PLATFORMS[targetPlatform].name} — جرّب مرة أخرى`);
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
