import { NextResponse } from "next/server";
import { findUserByEmail, getLastCompletedVideoAsset } from "@/lib/db";
import { buildVideoReadyTiming } from "@/lib/video-ready-timing";

export const runtime = "nodejs";

type Body = { email?: string };

/**
 * Ops: wall-clock timing for the user's most recent completed video.
 * Requires x-admin-secret = AUTH_SECRET.
 */
export async function POST(request: Request) {
  try {
    const secret = request.headers.get("x-admin-secret")?.trim();
    const expected = process.env.AUTH_SECRET?.trim();
    if (!expected || !secret || secret !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const email = body.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }

    const last = await getLastCompletedVideoAsset(user.id);

    if (!last) {
      return NextResponse.json({
        ok: true,
        email: user.email,
        found: false,
        message: "No completed videos for this account",
      });
    }

    const timing = await buildVideoReadyTiming(last);
    return NextResponse.json({
      ok: true,
      email: user.email,
      found: true,
      timing,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "timing failed" },
      { status: 500 },
    );
  }
}
