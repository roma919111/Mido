import type { PlatformId } from "../types";
import { markPlatformOpened } from "./app-navigation";
import { openPlatformLocked } from "./platform-open";
import { resolvePlatformDeepLink } from "./platform-deeplink";
import { startNativeHeadlessPlayback } from "./headless-player-native";
import { PLATFORMS } from "./platforms";
import type { TmdbDiscoverItem } from "./tmdb-discover";

/** Direct HLS/DASH/progressive — rendered inside MAX custom player. */
export type PlaybackMode = "in_app" | "ott_handoff";

export type PlaybackRequest = {
  mode: PlaybackMode;
  title: string;
  streamUrl?: string;
  platform?: PlatformId;
  tmdbId?: number;
  tmdbType?: "movie" | "tv";
  deeplinkUrl?: string;
  searchQuery?: string;
};

export type OttHandoffSession = {
  platform: PlatformId;
  title: string;
  startedAt: number;
};

export type InAppPlaybackSession = {
  title: string;
  streamUrl: string;
  posterUrl?: string;
};

function isDirectStreamUrl(url: string): boolean {
  return /\.m3u8(\?|$)/i.test(url) || /\.mpd(\?|$)/i.test(url) || /\.mp4(\?|$)/i.test(url);
}

export function buildInAppRequest(title: string, streamUrl: string): PlaybackRequest {
  return { mode: "in_app", title, streamUrl };
}

export async function buildOttRequest(
  item: TmdbDiscoverItem,
  platform: PlatformId,
): Promise<PlaybackRequest> {
  const link = await resolvePlatformDeepLink(
    item.tmdbId,
    item.tmdbType,
    platform,
    item.title,
    item.year,
  );

  return {
    mode: "ott_handoff",
    title: item.title,
    platform,
    tmdbId: item.tmdbId,
    tmdbType: item.tmdbType,
    deeplinkUrl: link.url ?? undefined,
    searchQuery: link.url ? undefined : link.searchQuery,
  };
}

export type PlaybackBridgeResult =
  | { kind: "in_app"; session: InAppPlaybackSession }
  | { kind: "native_surface" }
  | { kind: "ott_handoff"; session: OttHandoffSession }
  | { kind: "failed"; message: string };

/**
 * Unified playback coordinator.
 * - Direct streams → MAX custom player (Web HLS or native ExoPlayer surface).
 * - OTT DRM (Netflix/Shahid/TOD) → secure handoff; official app handles auth/DRM.
 */
export async function executePlaybackBridge(
  request: PlaybackRequest,
): Promise<PlaybackBridgeResult> {
  if (request.mode === "in_app" && request.streamUrl) {
    const streamUrl = request.streamUrl;
    if (!isDirectStreamUrl(streamUrl)) {
      return { kind: "failed", message: "Unsupported stream format" };
    }

    const nativeOk = await startNativeHeadlessPlayback(streamUrl, request.title, true);
    if (nativeOk) {
      return { kind: "native_surface" };
    }

    return {
      kind: "in_app",
      session: { title: request.title, streamUrl },
    };
  }

  if (request.mode === "ott_handoff" && request.platform) {
    const platform = request.platform;
    const result = await openPlatformLocked(platform, {
      url: request.deeplinkUrl,
      searchQuery: request.deeplinkUrl ? undefined : request.searchQuery,
      tmdbId: request.tmdbId,
      tmdbType: request.tmdbType,
    });

    if (result === "failed") {
      return {
        kind: "failed",
        message: `تعذر فتح ${PLATFORMS[platform].name}`,
      };
    }

    markPlatformOpened();
    return {
      kind: "ott_handoff",
      session: {
        platform,
        title: request.title,
        startedAt: Date.now(),
      },
    };
  }

  return { kind: "failed", message: "Playback request invalid" };
}

export function ottHandoffLabel(platform: PlatformId): string {
  return `جاري التشغيل على ${PLATFORMS[platform].name} — DRM في الخلفية`;
}
