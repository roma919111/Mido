import {
  extractVideoPart,
  getGeminiInteraction,
  mapGeminiInteractionStatus,
  parseGeminiHistoryId,
  persistGeminiVideoFromInteraction,
} from "@/lib/gemini-video";
import {
  getMiniMaxVideoTask,
  parseMiniMaxHistoryId,
  tryRecoverMiniMaxAsset,
} from "@/lib/minimax-video";
import {
  parseKlingHistoryId,
  tryRecoverKlingAsset,
} from "@/lib/kling-video";
import {
  parseFluxHistoryId,
  tryRecoverFluxAsset,
} from "@/lib/flux-video";
import {
  MINIMAX_HARD_FAIL_MS,
} from "@/lib/minimax-constants";
import { KLING_HARD_FAIL_MS } from "@/lib/kling-constants";
import { FLUX_HARD_FAIL_MS } from "@/lib/flux-constants";
import { GEMINI_JOB_TIMEOUT_MS } from "@/lib/gemini-constants";
import { refundFailedAssetCredits } from "@/lib/credit-refund";
import { listAssetsForUser, updateAsset } from "@/lib/db";
import { warmVideoPosterBackground } from "@/lib/poster-cache";
import { isRecoverableProviderAsset } from "@/lib/recover-provider-asset-utils";

export { isRecoverableProviderAsset } from "@/lib/recover-provider-asset-utils";

function assetAgeMs(createdAt?: string | null): number {
  const createdMs = Date.parse(createdAt || "");
  return Number.isFinite(createdMs) && createdMs > 0 ? Date.now() - createdMs : 0;
}

export type ProviderRecoverReport = {
  checked: number;
  recovered: number;
  stillPending: number;
  failed: number;
  assetIds: string[];
};

/** Re-download clips falsely marked failed / still running after UI timeout. */
export async function recoverUserProviderAssets(
  userId: string,
  opts?: { assetId?: string },
): Promise<ProviderRecoverReport> {
  const assets = await listAssetsForUser(userId, { includeHidden: true });
  const candidates = assets
    .filter((a) => {
      if (opts?.assetId && a.id !== opts.assetId) return false;
      return isRecoverableProviderAsset(a);
    })
    .slice(0, opts?.assetId ? 1 : 12);

  const report: ProviderRecoverReport = {
    checked: candidates.length,
    recovered: 0,
    stillPending: 0,
    failed: 0,
    assetIds: [],
  };

  for (const asset of candidates) {
    try {
      const mmId = parseMiniMaxHistoryId(asset.historyId || "");
      if (mmId) {
        const result = await tryRecoverMiniMaxAsset({
          userId,
          assetId: asset.id,
          historyId: asset.historyId!,
          hidden: false,
          mode: asset.mode,
        });
        if (result === "completed") {
          report.recovered += 1;
          report.assetIds.push(asset.id);
        } else if (result === "failed") {
          report.failed += 1;
        } else if (assetAgeMs(asset.createdAt) > MINIMAX_HARD_FAIL_MS) {
          const failMsg = "انتهت مهلة MiniMax (90 دقيقة) — تم استرجاع الكريديت.";
          await updateAsset(asset.id, userId, { status: "failed", error: failMsg });
          await refundFailedAssetCredits({
            userId,
            assetId: asset.id,
            errorMessage: failMsg,
          });
          report.failed += 1;
        } else if (asset.status === "running") {
          report.stillPending += 1;
        } else {
          report.failed += 1;
        }
        continue;
      }

      const klId = parseKlingHistoryId(asset.historyId || "");
      if (klId) {
        const result = await tryRecoverKlingAsset({
          userId,
          assetId: asset.id,
          historyId: asset.historyId!,
          hidden: false,
          mode: asset.mode,
        });
        if (result === "completed") {
          report.recovered += 1;
          report.assetIds.push(asset.id);
        } else if (result === "failed") {
          report.failed += 1;
        } else if (assetAgeMs(asset.createdAt) > KLING_HARD_FAIL_MS) {
          const failMsg = "انتهت مهلة Kling (60 دقيقة) — تم استرجاع الكريديت.";
          await updateAsset(asset.id, userId, { status: "failed", error: failMsg });
          await refundFailedAssetCredits({
            userId,
            assetId: asset.id,
            errorMessage: failMsg,
          });
          report.failed += 1;
        } else if (asset.status === "running") {
          report.stillPending += 1;
        } else {
          report.failed += 1;
        }
        continue;
      }

      const flId = parseFluxHistoryId(asset.historyId || "");
      if (flId) {
        const result = await tryRecoverFluxAsset({
          userId,
          assetId: asset.id,
          historyId: asset.historyId!,
          hidden: false,
          mode: asset.mode,
        });
        if (result === "completed") {
          report.recovered += 1;
          report.assetIds.push(asset.id);
        } else if (result === "failed") {
          report.failed += 1;
        } else if (assetAgeMs(asset.createdAt) > FLUX_HARD_FAIL_MS) {
          const failMsg = "انتهت مهلة FLUX (60 دقيقة) — تم استرجاع الكريديت.";
          await updateAsset(asset.id, userId, { status: "failed", error: failMsg });
          await refundFailedAssetCredits({
            userId,
            assetId: asset.id,
            errorMessage: failMsg,
          });
          report.failed += 1;
        } else if (asset.status === "running") {
          report.stillPending += 1;
        } else {
          report.failed += 1;
        }
        continue;
      }

      const gmId = parseGeminiHistoryId(asset.historyId || "");
      if (gmId) {
        const interaction = await getGeminiInteraction(gmId);
        let status = mapGeminiInteractionStatus(interaction.status);
        const part = extractVideoPart(interaction);
        if (part && status === "RUNNING") status = "COMPLETED";
        if (status === "COMPLETED" && part) {
          const localPath = await persistGeminiVideoFromInteraction(interaction);
          if (localPath) {
            await updateAsset(asset.id, userId, {
              url: localPath,
              status: "completed",
              error: undefined,
              hidden: asset.mode === "sequence-part",
            });
            warmVideoPosterBackground({
              url: localPath,
              historyId: asset.historyId,
            });
            report.recovered += 1;
            report.assetIds.push(asset.id);
          } else {
            report.stillPending += 1;
          }
        } else if (status === "FAILED") {
          report.failed += 1;
        } else if (assetAgeMs(asset.createdAt) > GEMINI_JOB_TIMEOUT_MS) {
          const failMsg = "انتهت مهلة Gemini (20 دقيقة) — تم استرجاع الكريديت.";
          await updateAsset(asset.id, userId, { status: "failed", error: failMsg });
          await refundFailedAssetCredits({
            userId,
            assetId: asset.id,
            errorMessage: failMsg,
          });
          report.failed += 1;
        } else if (asset.status === "running") {
          report.stillPending += 1;
        } else {
          report.failed += 1;
        }
      }
    } catch (err) {
      console.warn(
        `[veronix] recover asset ${asset.id}:`,
        err instanceof Error ? err.message : err,
      );
      if (asset.status === "running" && assetAgeMs(asset.createdAt) <= 2 * 60 * 1000) {
        report.stillPending += 1;
      } else {
        report.failed += 1;
      }
    }
  }

  // Unhide any completed provider clips that were recovered but left hidden.
  const refreshed = await listAssetsForUser(userId, { includeHidden: true });
  for (const asset of refreshed) {
    if (
      asset.hidden === true &&
      asset.status === "completed" &&
      asset.url &&
      asset.mode !== "sequence-part" &&
      (parseMiniMaxHistoryId(asset.historyId || "") ||
        parseGeminiHistoryId(asset.historyId || "") ||
        parseKlingHistoryId(asset.historyId || "") ||
        parseFluxHistoryId(asset.historyId || ""))
    ) {
      await updateAsset(asset.id, userId, { hidden: false, error: undefined });
      if (!report.assetIds.includes(asset.id)) {
        report.recovered += 1;
        report.assetIds.push(asset.id);
      }
    }
  }

  return report;
}

/** Ops: probe MiniMax without mutating DB. */
export async function probeMiniMaxTask(historyId: string) {
  const mmId = parseMiniMaxHistoryId(historyId);
  if (!mmId) return null;
  return getMiniMaxVideoTask(mmId);
}
