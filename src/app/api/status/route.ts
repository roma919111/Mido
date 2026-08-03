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
    const task = await getBytePlusVideoTask(byteplusId);
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
