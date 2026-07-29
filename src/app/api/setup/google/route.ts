import { NextResponse } from "next/server";
import { saveGoogleCredentials, hasGoogleCredentials } from "@/lib/google-credentials";
import { getAppBaseUrl } from "@/lib/app-url";
import { getGoogleRedirectUri } from "@/lib/google-oauth";
import { isOwnerSetupAuthorized } from "@/lib/owner-credentials";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isOwnerSetupAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    configured: await hasGoogleCredentials(),
    appBaseUrl: getAppBaseUrl(),
    redirectUri: getGoogleRedirectUri(),
  });
}

export async function POST(request: Request) {
  if (!isOwnerSetupAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      clientId?: string;
      clientSecret?: string;
    };
    const clientId = body.clientId?.trim() || "";
    const clientSecret = body.clientSecret?.trim() || "";
    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "clientId and clientSecret are required" },
        { status: 400 },
      );
    }

    await saveGoogleCredentials({ clientId, clientSecret });
    return NextResponse.json({
      ok: true,
      configured: true,
      redirectUri: getGoogleRedirectUri(),
      message: "Google OAuth credentials saved. Continue with Google is ready.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Save failed" },
      { status: 500 },
    );
  }
}
