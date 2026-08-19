import { adjustCredits, findAssetById, updateAsset } from "@/lib/db";

export const REFUND_NOTE = "تم استرجاع الكريديت";
export const FAIL_REFUND_FOOTER = `فشل التوليد · ${REFUND_NOTE}`;

export function hasRefundNote(message: string | null | undefined): boolean {
  return Boolean(
    message &&
      (message.includes(REFUND_NOTE) || message.includes(FAIL_REFUND_FOOTER)),
  );
}

export function withRefundNote(message: string): string {
  const base = (message || "فشل التوليد").trim();
  if (hasRefundNote(base)) return base;
  if (
    base === "فشل التوليد" ||
    /BytePlus generation failed|Generation failed|Image generation failed/i.test(
      base,
    )
  ) {
    return FAIL_REFUND_FOOTER;
  }
  return `${base}\n${FAIL_REFUND_FOOTER}`;
}

/**
 * Idempotent refund when a paid generation fails.
 * Returns how many credits were returned (0 if already refunded / free).
 */
export async function refundFailedAssetCredits(input: {
  userId: string;
  assetId: string;
  errorMessage?: string;
}): Promise<{ refunded: number; errorMessage: string }> {
  const asset = await findAssetById(input.userId, input.assetId);
  if (!asset) {
    return {
      refunded: 0,
      errorMessage: withRefundNote(input.errorMessage || "فشل التوليد"),
    };
  }

  const amount = Math.max(0, Math.floor(Number(asset.creditsUsed) || 0));
  const baseError = input.errorMessage || asset.error || "فشل التوليد";

  if (amount <= 0) {
    // Already refunded → keep the refund note. Free / never charged → no note.
    if (hasRefundNote(asset.error)) {
      return { refunded: 0, errorMessage: withRefundNote(baseError) };
    }
    if (asset.status !== "failed") {
      await updateAsset(asset.id, input.userId, {
        status: "failed",
        error: baseError,
      });
    }
    return { refunded: 0, errorMessage: baseError };
  }

  const nextError = withRefundNote(baseError);
  await adjustCredits(input.userId, amount);
  await updateAsset(asset.id, input.userId, {
    status: "failed",
    creditsUsed: 0,
    error: nextError,
  });

  return { refunded: amount, errorMessage: nextError };
}

/**
 * Keep credits for the seconds that actually landed; refund the rest.
 * Does not mark the asset failed.
 */
export async function settlePartialGenerationCredits(input: {
  userId: string;
  assetId: string;
  keepCredits: number;
}): Promise<{ refunded: number; kept: number }> {
  const asset = await findAssetById(input.userId, input.assetId);
  if (!asset) return { refunded: 0, kept: 0 };
  const charged = Math.max(0, Math.floor(Number(asset.creditsUsed) || 0));
  const keep = Math.max(0, Math.min(charged, Math.floor(input.keepCredits)));
  const refund = charged - keep;
  if (refund <= 0) return { refunded: 0, kept: charged };
  await adjustCredits(input.userId, refund);
  await updateAsset(asset.id, input.userId, { creditsUsed: keep });
  return { refunded: refund, kept: keep };
}
