/**
 * LTX 2.5 HF Space — show preview at HF speed; persist to /generations in background.
 */

import { updateAsset, type AssetRecord } from "@/lib/db";
import { saveLocalVideo } from "@/lib/local-media";
import { veronixMediaSrc } from "@/lib/media-proxy";
import { warmVideoPosterBackground } from "@/lib/poster-cache";
import {
  isLtxDeployedHistoryId,
  isLtxFullPersistedVideoUrl,
} from "@/lib/studio-deliverable";
import { VERONIX_DEPLOYED_MODEL_ID } from "@/lib/ltx25-deployed";

export const LTX25_DEPLOYED_HISTORY_PREFIX = "ltx25-deployed-";

export type Ltx25DeployedJobMeta = {
  kind?: "ltx25-deployed";
  /** Raw MP4 URL from HF Space (available ~60s). */
  remoteUrl?: string;
  /** Same as remoteUrl once preview is wired for the player. */
  remotePreviewUrl?: string;
  persist?: "pending" | "done" | "failed";
  hfEventId?: string;
};

const persistInflight = new Set<string>();

export function parseLtx25DeployedHistoryId(
  historyId: string | null | undefined,
): string | null {
  const raw = String(historyId || "").trim();
  if (!raw.startsWith(LTX25_DEPLOYED_HISTORY_PREFIX)) return null;
  const id = raw.slice(LTX25_DEPLOYED_HISTORY_PREFIX.length).trim();
  return id || null;
}

export function toLtx25DeployedHistoryId(jobId: string): string {
  return `${LTX25_DEPLOYED_HISTORY_PREFIX}${jobId}`;
}

export function isLtx25DeployedAsset(asset: {
  historyId?: string | null;
  modelId?: string | null;
  jobMeta?: unknown;
}): boolean {
  if (isLtxDeployedHistoryId(asset.historyId)) return true;
  if (String(asset.modelId || "").trim() === VERONIX_DEPLOYED_MODEL_ID) return true;
  const meta = parseLtx25JobMeta(asset.jobMeta);
  return meta?.kind === "ltx25-deployed";
}

export function parseLtx25JobMeta(raw: unknown): Ltx25DeployedJobMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Ltx25DeployedJobMeta;
  if (m.kind && m.kind !== "ltx25-deployed") return null;
  return m;
}

export function ltx25RemoteSourceUrl(asset: AssetRecord): string | null {
  const meta = parseLtx25JobMeta(asset.jobMeta);
  const fromMeta = meta?.remotePreviewUrl?.trim() || meta?.remoteUrl?.trim();
  if (fromMeta) return fromMeta;
  const url = asset.url?.trim() || "";
  if (url && !url.startsWith("/generations/") && !url.startsWith("/api/")) {
    return url;
  }
  return null;
}

/** Proxy URL the browser can play immediately (HF parity). */
export function ltx25PreviewPlaybackUrl(input: {
  remoteUrl: string;
  historyId?: string | null;
}): string | null {
  return (
    veronixMediaSrc({
      url: input.remoteUrl,
      historyId: input.historyId || undefined,
      mediaType: "video",
    }) || input.remoteUrl
  );
}

export async function downloadLtx25Video(remoteUrl: string): Promise<string> {
  const res = await fetch(remoteUrl, {
    redirect: "follow",
    headers: { Accept: "video/*", "User-Agent": "VyronixLtx25/1.0" },
  });
  if (!res.ok) {
    throw new Error(`LTX video download failed (${res.status})`);
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 1000) {
    throw new Error("LTX returned an empty video file");
  }
  const contentType =
    res.headers.get("content-type")?.split(";")[0]?.trim() || "video/mp4";
  const { localPath } = await saveLocalVideo({
    bytes,
    contentType,
    prefix: "ltx25",
  });
  return localPath;
}

function scheduleLtx25BackgroundPersist(
  userId: string,
  assetId: string,
  historyId: string,
  remoteUrl: string,
) {
  if (persistInflight.has(assetId)) return;
  persistInflight.add(assetId);
  void (async () => {
    try {
      const localPath = await downloadLtx25Video(remoteUrl);
      await updateAsset(assetId, userId, {
        historyId,
        url: localPath,
        status: "completed",
        error: undefined,
        jobMeta: {
          kind: "ltx25-deployed",
          remoteUrl,
          remotePreviewUrl: remoteUrl,
          persist: "done",
        },
      });
      warmVideoPosterBackground({ url: localPath, historyId });
    } catch (error) {
      console.warn(
        `[veronix] ltx25 background persist failed ${assetId}:`,
        error instanceof Error ? error.message : error,
      );
      await updateAsset(assetId, userId, {
        jobMeta: {
          kind: "ltx25-deployed",
          remoteUrl,
          remotePreviewUrl: remoteUrl,
          persist: "failed",
        },
      }).catch(() => null);
    } finally {
      persistInflight.delete(assetId);
    }
  })();
}

/**
 * When HF has a URL but the asset is still "running", expose preview immediately
 * and persist to disk without blocking the status response.
 */
export async function ensureLtx25PreviewDelivered(
  userId: string,
  asset: AssetRecord,
): Promise<AssetRecord> {
  if (!isLtx25DeployedAsset(asset)) return asset;

  const remote = ltx25RemoteSourceUrl(asset);
  if (!remote) return asset;

  const meta = parseLtx25JobMeta(asset.jobMeta) || { kind: "ltx25-deployed" as const };
  const historyId = asset.historyId || toLtx25DeployedHistoryId(asset.id);
  const preview = ltx25PreviewPlaybackUrl({ remoteUrl: remote, historyId });
  const alreadyLocal =
    asset.url?.startsWith("/generations/") && isLtxFullPersistedVideoUrl(asset.url);

  if (alreadyLocal && asset.status === "completed") return asset;

  let next = asset;
  if (preview && asset.url !== preview) {
    next =
      (await updateAsset(asset.id, userId, {
        url: preview,
        historyId,
        jobMeta: {
          ...meta,
          remoteUrl: remote,
          remotePreviewUrl: remote,
          persist: meta.persist === "done" ? "done" : "pending",
        },
      })) || asset;
  }

  if (meta.persist !== "done" && !alreadyLocal) {
    scheduleLtx25BackgroundPersist(userId, asset.id, historyId, remote);
  }

  return next;
}

export type Ltx25StatusPayload = {
  assetId: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  urls: string[];
  live: true;
  provider: "ltx25";
  pollAfterSeconds?: number;
  note?: string;
  error?: string;
};

/** Status API: return playable URL while status may still be RUNNING. */
export function buildLtx25StatusPayload(asset: AssetRecord): Ltx25StatusPayload | null {
  if (!isLtx25DeployedAsset(asset)) return null;

  const playback = asset.url?.trim() || "";
  const remote = ltx25RemoteSourceUrl(asset);

  if (asset.status === "failed") {
    return {
      assetId: asset.id,
      status: "FAILED",
      urls: [],
      live: true,
      provider: "ltx25",
      error: asset.error || "فشل توليد LTX",
    };
  }

  if (asset.status === "completed" && playback) {
    return {
      assetId: asset.id,
      status: "COMPLETED",
      urls: [playback],
      live: true,
      provider: "ltx25",
    };
  }

  if (playback || remote) {
    const url =
      playback ||
      ltx25PreviewPlaybackUrl({
        remoteUrl: remote!,
        historyId: asset.historyId,
      }) ||
      remote!;
    const persistPending =
      parseLtx25JobMeta(asset.jobMeta)?.persist === "pending" ||
      asset.status === "running";
    return {
      assetId: asset.id,
      // Treat HF preview as done for UI/polling; disk persist continues in background.
      status: "COMPLETED",
      urls: [url],
      live: true,
      provider: "ltx25",
      pollAfterSeconds: persistPending ? 1.2 : undefined,
      note: persistPending
        ? "جاري حفظ نسخة Vyronix في الخلفية…"
        : undefined,
    };
  }

  if (asset.status === "running") {
    return {
      assetId: asset.id,
      status: "RUNNING",
      urls: [],
      live: true,
      provider: "ltx25",
      pollAfterSeconds: 1.2,
    };
  }

  return null;
}
