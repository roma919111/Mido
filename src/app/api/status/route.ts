import { NextResponse } from "next/server";
import {
  getBytePlusVideoTask,
  mapBytePlusStatus,
  parseBytePlusHistoryId,
} from "@/lib/byteplus-ark";
import {
  getPixVerseVideoTask,
  mapPixVerseStatus,
  parsePixVerseHistoryId,
  pixVerseFailureMessage,
} from "@/lib/pixverse";
import {
  extractVideoPart,
  finalizeGeminiVideoJob,
  geminiFailureMessage,
  getGeminiInteraction,
  mapGeminiInteractionStatus,
  parseGeminiHistoryId,
  persistGeminiVideoFromInteraction,
} from "@/lib/gemini-video";
import { GEMINI_JOB_TIMEOUT_MS } from "@/lib/gemini-constants";
import {
  downloadMiniMaxVideo,
  finalizeMiniMaxVideoJob,
  getMiniMaxVideoTask,
  parseMiniMaxHistoryId,
} from "@/lib/minimax-video";
import { MINIMAX_HARD_FAIL_MS } from "@/lib/minimax-constants";
import { getCurrentUser } from "@/lib/customer-auth";
import { findAssetByHistoryId, findAssetById, updateAsset } from "@/lib/db";
import { ensureClarityUrl, shouldApplyClarityGrade } from "@/lib/ensure-clarity";
import { refundFailedAssetCredits } from "@/lib/credit-refund";
import { translateBytePlusError } from "@/lib/byteplus-errors";
import { warmVideoPosterBackground } from "@/lib/poster-cache";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const historyId = searchParams.get("historyId");
  const assetId = searchParams.get("assetId")?.trim() || "";

  // Image studio (and any job without a provider history id): poll by assetId.
  if (!historyId && assetId) {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Login required", needsAuth: true },
        { status: 401 },
      );
    }
    const asset = await findAssetById(user.id, assetId);
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Late failures (async image jobs): refund if still charged.
    let failureError = asset.error || "Generation failed";
    let creditsRefunded = false;
    if (asset.status === "failed") {
      const refund = await refundFailedAssetCredits({
        userId: user.id,
        assetId: asset.id,
        errorMessage: asset.error || "Generation failed",
      });
      failureError = refund.errorMessage;
      creditsRefunded =
        refund.refunded > 0 ||
        (Number(asset.creditsUsed || 0) === 0 &&
          Boolean(asset.error?.includes("تم استرجاع الكريديت")));
    }

    const status =
      asset.status === "completed"
        ? "COMPLETED"
        : asset.status === "failed"
          ? "FAILED"
          : "RUNNING";
    return NextResponse.json({
      assetId,
      status,
      urls: asset.url ? [asset.url] : [],
      live: true,
      provider: asset.mediaType === "image" ? "byteplus" : "veronix",
      pollAfterSeconds: status === "RUNNING" ? 3 : undefined,
      error: status === "FAILED" ? failureError : undefined,
      creditsRefunded: status === "FAILED" ? creditsRefunded : undefined,
      note: status === "FAILED" && creditsRefunded ? "تم استرجاع الكريديت" : undefined,
    });
  }

  if (!historyId) {
    return NextResponse.json({ error: "historyId is required" }, { status: 400 });
  }

  const miniMaxId = parseMiniMaxHistoryId(historyId);
  if (miniMaxId) {
    try {
      const task = await getMiniMaxVideoTask(miniMaxId);
      let status = task.status;
      let urls: string[] = [];
      let failureError = task.error || "فشل توليد MiniMax H3";

      const user = await getCurrentUser().catch(() => null);
      let creditsRefunded = false;
      const byHistory = user ? await findAssetByHistoryId(user.id, historyId) : null;
      const targetId = assetId || byHistory?.id;
      const assetRow =
        user && targetId ? await findAssetById(user.id, targetId) : byHistory;
      const createdMs = assetRow?.createdAt ? Date.parse(assetRow.createdAt) : NaN;
      const jobAgeMs =
        Number.isFinite(createdMs) && createdMs > 0 ? Date.now() - createdMs : 0;

      if (status === "COMPLETED" && task.remoteUrl) {
        try {
          const localPath = await downloadMiniMaxVideo(task.remoteUrl);
          urls = [localPath];
          if (user && targetId) {
            await updateAsset(targetId, user.id, {
              historyId,
              url: localPath,
              status: "completed",
              error: undefined,
            }).catch(() => null);
            warmVideoPosterBackground({ url: localPath, historyId });
          }
        } catch (error) {
          console.warn(
            `[veronix] minimax video persist failed ${miniMaxId}:`,
            error instanceof Error ? error.message : error,
          );
        }
      }

      if (status === "RUNNING" && jobAgeMs > MINIMAX_HARD_FAIL_MS) {
        status = "FAILED";
        failureError =
          "انتهت مهلة MiniMax (90 دقيقة) — تم استرجاع الكريديت.";
      } else if (
        status === "RUNNING" &&
        !urls.length &&
        user &&
        targetId &&
        jobAgeMs > 45_000
      ) {
        void finalizeMiniMaxVideoJob({
          taskId: miniMaxId,
          historyId,
          assetId: targetId,
          userId: user.id,
        });
      }

      if (status === "FAILED" && user && targetId) {
        const refund = await refundFailedAssetCredits({
          userId: user.id,
          assetId: targetId,
          errorMessage: failureError,
        });
        creditsRefunded = refund.refunded > 0;
        failureError = refund.errorMessage;
      }

      return NextResponse.json({
        historyId,
        status,
        urls,
        live: true,
        provider: "minimax",
        pollAfterSeconds: status === "RUNNING" ? 10 : undefined,
        error: status === "FAILED" ? failureError : undefined,
        creditsRefunded: status === "FAILED" ? creditsRefunded : undefined,
        note:
          status === "FAILED" && creditsRefunded ? "تم استرجاع الكريديت" : undefined,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "MiniMax status failed",
          historyId,
          provider: "minimax",
        },
        { status: 502 },
      );
    }
  }

  const pixverseId = parsePixVerseHistoryId(historyId);
  if (pixverseId) {
    try {
      const task = await getPixVerseVideoTask(pixverseId);
      const status = mapPixVerseStatus(task.status);
      const urls = task.url ? [task.url] : [];
      const failureError = pixVerseFailureMessage(task.status);

      const user = await getCurrentUser().catch(() => null);
      let creditsRefunded = false;

      if (user && (urls[0] || status === "FAILED")) {
        const byHistory = await findAssetByHistoryId(user.id, historyId);
        const targetId = assetId || byHistory?.id;
        if (targetId) {
          if (urls[0]) {
            await updateAsset(targetId, user.id, {
              historyId,
              url: urls[0],
              status: "completed",
              error: undefined,
            }).catch(() => null);
            warmVideoPosterBackground({ url: urls[0], historyId });
          } else if (status === "FAILED") {
            const refund = await refundFailedAssetCredits({
              userId: user.id,
              assetId: targetId,
              errorMessage: failureError,
            });
            creditsRefunded = true;
          }
        }
      }

      return NextResponse.json({
        historyId,
        status,
        urls,
        live: true,
        provider: "pixverse",
        pollAfterSeconds: status === "RUNNING" ? 4 : undefined,
        error: status === "FAILED" ? failureError : undefined,
        creditsRefunded: status === "FAILED" ? creditsRefunded : undefined,
        note:
          status === "FAILED" && creditsRefunded ? "تم استرجاع الكريديت" : undefined,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "PixVerse status failed",
          historyId,
          provider: "pixverse",
        },
        { status: 502 },
      );
    }
  }

  const geminiId = parseGeminiHistoryId(historyId);
  if (geminiId) {
    try {
      const interaction = await getGeminiInteraction(geminiId);
      let status = mapGeminiInteractionStatus(interaction.status);
      let urls: string[] = [];
      let failureError = geminiFailureMessage(interaction);
      const part = extractVideoPart(interaction);

      console.info(
        `[veronix] gemini status ${geminiId} raw=${interaction.status} mapped=${status} hasPart=${Boolean(part)}`,
      );

      const user = await getCurrentUser().catch(() => null);
      let creditsRefunded = false;
      const byHistory = user ? await findAssetByHistoryId(user.id, historyId) : null;
      const targetId = assetId || byHistory?.id;
      const assetRow =
        user && targetId ? await findAssetById(user.id, targetId) : byHistory;
      const createdMs = assetRow?.createdAt ? Date.parse(assetRow.createdAt) : NaN;
      const jobAgeMs =
        Number.isFinite(createdMs) && createdMs > 0 ? Date.now() - createdMs : 0;

      // Video payload may appear while Google still reports in_progress.
      if (part && status === "RUNNING") {
        try {
          const localPath = await persistGeminiVideoFromInteraction(interaction);
          if (localPath) {
            urls = [localPath];
            status = "COMPLETED";
            if (user && targetId) {
              await updateAsset(targetId, user.id, {
                historyId,
                url: localPath,
                status: "completed",
                error: undefined,
              }).catch(() => null);
              warmVideoPosterBackground({ url: localPath, historyId });
            }
          }
        } catch (error) {
          console.warn(
            `[veronix] gemini early video persist failed ${geminiId}:`,
            error instanceof Error ? error.message : error,
          );
        }
      }

      if (status === "RUNNING" && jobAgeMs > GEMINI_JOB_TIMEOUT_MS) {
        status = "FAILED";
        failureError =
          "انتهت مهلة Gemini (20 دقيقة) — تم استرجاع الكريديت. Google قد يكون خصم الرصيد عندهم.";
      } else if (
        status === "RUNNING" &&
        !urls.length &&
        user &&
        targetId &&
        jobAgeMs > 45_000
      ) {
        void finalizeGeminiVideoJob({
          interactionId: geminiId,
          historyId,
          assetId: targetId,
          userId: user.id,
        });
      }

      if (status === "COMPLETED" && !part) {
        const updatedMs = interaction.updated
          ? Date.parse(interaction.updated)
          : NaN;
        const ageMs =
          Number.isFinite(updatedMs) && updatedMs > 0
            ? Date.now() - updatedMs
            : 0;
        if (ageMs < 3 * 60_000) {
          status = "RUNNING";
        } else {
          status = "FAILED";
          failureError = "اكتمل Gemini لكن الفيديو لم يظهر — أعد المحاولة";
        }
      }

      if (status === "COMPLETED" && part) {
        try {
          const localPath = await persistGeminiVideoFromInteraction(interaction);
          if (localPath) {
            urls = [localPath];
            if (user && targetId) {
              await updateAsset(targetId, user.id, {
                historyId,
                url: localPath,
                status: "completed",
                error: undefined,
              }).catch(() => null);
              warmVideoPosterBackground({ url: localPath, historyId });
            }
          } else {
            status = "FAILED";
            failureError = "اكتمل Gemini لكن لم يُرجع ملف فيديو";
          }
        } catch (error) {
          status = "FAILED";
          failureError =
            error instanceof Error
              ? error.message
              : "فشل حفظ فيديو Gemini على السيرفر";
        }
      }

      if (user && targetId && status === "FAILED") {
        const refund = await refundFailedAssetCredits({
          userId: user.id,
          assetId: targetId,
          errorMessage: failureError,
        });
        creditsRefunded = refund.refunded > 0;
        await updateAsset(targetId, user.id, {
          status: "failed",
          error: failureError,
        }).catch(() => null);
      }

      return NextResponse.json({
        historyId,
        status,
        urls,
        live: true,
        provider: "gemini",
        pollAfterSeconds: status === "RUNNING" ? 6 : undefined,
        error: status === "FAILED" ? failureError : undefined,
        creditsRefunded: status === "FAILED" ? creditsRefunded : undefined,
        note:
          status === "FAILED" && creditsRefunded ? "تم استرجاع الكريديت" : undefined,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Gemini status failed",
          historyId,
          provider: "gemini",
        },
        { status: 502 },
      );
    }
  }

  const byteplusId = parseBytePlusHistoryId(historyId);
  if (!byteplusId) {
    return NextResponse.json(
      {
        error: "Unknown history id — OpenArt ids are no longer supported",
        historyId,
        provider: "byteplus",
      },
      { status: 404 },
    );
  }

  try {
    const pollUser = await getCurrentUser().catch(() => null);
    const pollAsset =
      pollUser && (assetId || historyId)
        ? assetId
          ? await findAssetById(pollUser.id, assetId)
          : await findAssetByHistoryId(pollUser.id, historyId!)
        : null;
    const task = await getBytePlusVideoTask(
      byteplusId,
      pollAsset?.model || undefined,
    );
    const status = mapBytePlusStatus(task.status);
    const urls = task.content?.video_url ? [task.content.video_url] : [];
    const errMsg =
      typeof task.error === "string"
        ? task.error
        : task.error && typeof task.error === "object"
          ? String(task.error.message || task.error.code || "")
          : "";

    const user = await getCurrentUser().catch(() => null);
    let creditsRefunded = false;
    let failureError = errMsg
      ? translateBytePlusError(errMsg)
      : "فشل التوليد من Veronix لسبب غير معروف.";

    if (user && (urls[0] || status === "FAILED")) {
      const byHistory = await findAssetByHistoryId(user.id, historyId);
      const targetId = assetId || byHistory?.id;
      if (targetId) {
        const existing = byHistory;
        const keepHidden = existing?.mode === "sequence-part";
        if (urls[0]) {
          const wantClarity = shouldApplyClarityGrade({
            preferClarity: existing?.preferClarity,
            resolution: existing?.resolution,
            mode: existing?.mode,
          });
          // Never block status polling on ffmpeg clarity — that timed out 720p
          // jobs and looked like "clarity always fails". Save CDN first; grade async.
          await updateAsset(targetId, user.id, {
            historyId,
            url: urls[0],
            status: "completed",
            error: undefined,
            hidden: keepHidden ? true : false,
          }).catch(() => null);
          warmVideoPosterBackground({ url: urls[0], historyId });
          if (wantClarity && !keepHidden) {
            void (async () => {
              try {
                const graded = await ensureClarityUrl(urls[0]!);
                if (graded && graded !== urls[0]) {
                  await updateAsset(targetId, user.id, { url: graded });
                  warmVideoPosterBackground({ url: graded, historyId });
                }
              } catch (err) {
                console.warn(
                  "[veronix] async clarity skipped:",
                  err instanceof Error ? err.message : err,
                );
              }
            })();
          }
        } else if (status === "FAILED") {
          const refund = await refundFailedAssetCredits({
            userId: user.id,
            assetId: targetId,
            errorMessage: failureError,
          });
          if (keepHidden) {
            await updateAsset(targetId, user.id, { hidden: true }).catch(() => null);
          }
          creditsRefunded = true;
          failureError = refund.errorMessage;
        }
      }
    }

    return NextResponse.json({
      historyId,
      status,
      urls,
      live: true,
      provider: "byteplus",
      pollAfterSeconds: status === "RUNNING" || status === "PENDING" ? 8 : undefined,
      error: status === "FAILED" ? failureError : undefined,
      creditsRefunded: status === "FAILED" ? creditsRefunded : undefined,
      note: status === "FAILED" && creditsRefunded ? "تم استرجاع الكريديت" : undefined,
      details: task.raw,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Veronix status failed",
        historyId,
        live: true,
        provider: "byteplus",
      },
      { status: 502 },
    );
  }
}
