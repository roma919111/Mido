import { NextResponse } from "next/server";
import { isOwnerSetupAuthorized } from "@/lib/owner-credentials";
import {
  googleRedirectUriForOrigin,
  loadLockedPublicOrigin,
  saveLockedPublicOrigin,
} from "@/lib/public-base-url";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isOwnerSetupAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const origin = loadLockedPublicOrigin();
  return NextResponse.json({
    locked: Boolean(origin),
    appBaseUrl: origin,
    redirectUri: origin ? googleRedirectUriForOrigin(origin) : null,
  });
}

export async function POST(request: Request) {
  if (!isOwnerSetupAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { url?: string };
    const url = body.url?.trim() || "";
    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }
    const origin = saveLockedPublicOrigin(url);
    return NextResponse.json({
      ok: true,
      locked: true,
      appBaseUrl: origin,
      redirectUri: googleRedirectUriForOrigin(origin),
      message:
        "تم قفل الرابط. ضع redirectUri في Google Console مرة واحدة — التطبيق لن يغيّره تلقائيًا.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Save failed" },
      { status: 400 },
    );
  }
}
