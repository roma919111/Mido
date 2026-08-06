import { NextResponse } from "next/server";
import { readReferralCookie, setReferralCookie } from "@/lib/referral-cookie";
import { normalizeReferralCode } from "@/lib/referral";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { code?: string };
    const code = normalizeReferralCode(body.code);
    if (!code) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }
    await setReferralCookie(code);
    return NextResponse.json({ ok: true, code });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}
