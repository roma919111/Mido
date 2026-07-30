import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { setAssetsHidden } from "@/lib/db";

export const runtime = "nodejs";

type Body = {
  assetIds?: string[];
  hidden?: boolean;
};

/** Show/hide multi-shot part assets (e.g. unhide when stitch fails). */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Login required", needsAuth: true }, { status: 401 });
    }
    const body = (await request.json()) as Body;
    const ids = Array.isArray(body.assetIds)
      ? body.assetIds.filter((id): id is string => typeof id === "string" && Boolean(id.trim()))
      : [];
    if (!ids.length) {
      return NextResponse.json({ error: "assetIds required" }, { status: 400 });
    }
    if (ids.length > 20) {
      return NextResponse.json({ error: "Too many assetIds" }, { status: 400 });
    }
    const hidden = Boolean(body.hidden);
    const updated = await setAssetsHidden(user.id, ids, hidden);
    return NextResponse.json({ updated, hidden });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "visibility update failed" },
      { status: 500 },
    );
  }
}
