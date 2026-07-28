import { NextResponse } from "next/server";
import {
  getBytePlusVideoTask,
  mapBytePlusStatus,
  parseBytePlusHistoryId,
} from "@/lib/byteplus-ark";
import { getCurrentUser } from "@/lib/customer-auth";
import { findAssetByHistoryId, findAssetById, updateAsset } from "@/lib/db";
import { ensureClarityUrl } from "@/lib/ensure-clarity";
import { refundFailedAssetCredits } from "@/lib/credit-refund";

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
    let failureError = errMsg || "BytePlus generation failed";

    if (user && (urls[0] || status === "FAILED")) {
      const byHistory = await findAssetByHistoryId(user.id, historyId);
      const targetId = assetId || byHistory?.id;
      if (targetId) {
        const existing = byHistory;
        const keepHidden = existing?.mode === "sequence-part";
        if (urls[0]) {
          const wantClarity = Boolean(existing?.preferClarity);
          const graded =
            keepHidden || !wantClarity
              ? urls[0]
              : await ensureClarityUrl(urls[0]);
          await updateAsset(targetId, user.id, {
            historyId,
            url: graded,
            status: "completed",
            error: undefined,
            hidden: keepHidden ? true : false,
          }).catch(() => null);
          urls[0] = graded;
        } else if (status === "FAILED") {
          const refund = await refundFailedAssetCredits({
            userId: user.id,
            assetId: targetId,
            errorMessage: errMsg || "BytePlus generation failed",
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
        error: error instanceof Error ? error.message : "BytePlus status failed",
        historyId,
        live: true,
        provider: "byteplus",
      },
      { status: 502 },
    );
  }
}
