import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { listAssetsForUser } from "@/lib/db";
import { recoverUserProviderAssets } from "@/lib/recover-provider-assets";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Force re-download from MiniMax / Gemini for timed-out or stuck clips. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required", needsAuth: true }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { id?: string };
    const assetId = body.id?.trim() || undefined;

    const report = await recoverUserProviderAssets(user.id, { assetId });
    const assets = await listAssetsForUser(user.id);

    return NextResponse.json({
      ok: true,
      report,
      assets,
      message:
        report.recovered > 0
          ? "تم استرجاع الفيديو بنجاح"
          : report.checked === 0
            ? undefined
            : report.stillPending > 0
              ? "ما زال التوليد جاريًا عند المزود — حاول بعد دقائق"
              : report.failed > 0
                ? "تعذر استرجاع الفيديو — قد يكون غير متاح عند المزود"
                : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Recover failed",
      },
      { status: 500 },
    );
  }
}
