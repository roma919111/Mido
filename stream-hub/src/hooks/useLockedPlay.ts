import { useCallback } from "react";
import type { PlatformId } from "../types";
import {
  buildOttRequest,
  executePlaybackBridge,
  type InAppPlaybackSession,
  type OttHandoffSession,
} from "../lib/playback-bridge";
import { pushRecentItem, type TmdbDiscoverItem } from "../lib/tmdb-discover";

function reportPlayError(message: string): void {
  window.dispatchEvent(new CustomEvent("max-play-error", { detail: message }));
}

function reportInAppSession(session: InAppPlaybackSession): void {
  window.dispatchEvent(new CustomEvent("max-in-app-playback", { detail: session }));
}

function reportOttHandoff(session: OttHandoffSession): void {
  window.dispatchEvent(new CustomEvent("max-ott-handoff", { detail: session }));
}

function resolveItemPlatform(item: TmdbDiscoverItem, override?: PlatformId): PlatformId {
  return item.platform ?? override ?? "netflix";
}

export function useLockedPlay(defaultPlatform: PlatformId = "netflix") {
  const play = useCallback((item: TmdbDiscoverItem, platform?: PlatformId) => {
    const targetPlatform = resolveItemPlatform(item, platform ?? defaultPlatform);
    pushRecentItem({ ...item, platform: targetPlatform });

    void (async () => {
      const request = await buildOttRequest(item, targetPlatform);
      const result = await executePlaybackBridge(request);

      if (result.kind === "failed") {
        reportPlayError(result.message);
        return;
      }
      if (result.kind === "in_app") {
        reportInAppSession(result.session);
        return;
      }
      if (result.kind === "ott_handoff") {
        reportOttHandoff(result.session);
      }
      /* native_surface: PlayerSurfaceActivity handles UI — no web overlay */
    })();
  }, [defaultPlatform]);

  const openApp = useCallback((platform: PlatformId = defaultPlatform) => {
    void executePlaybackBridge({
      mode: "ott_handoff",
      title: platform,
      platform,
    }).then((result) => {
      if (result.kind === "failed") {
        reportPlayError("تعذر فتح التطبيق");
      } else if (result.kind === "ott_handoff") {
        reportOttHandoff(result.session);
      }
    });
  }, [defaultPlatform]);

  return { play, openApp };
}
