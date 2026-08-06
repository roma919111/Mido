import { NextResponse } from "next/server";
import { registerUser } from "@/lib/customer-auth";
import { readReferralCookie } from "@/lib/referral-cookie";
import { normalizeReferralCode } from "@/lib/referral";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      name?: string;
      referralCode?: string;
    };
    const cookieRef = await readReferralCookie();
    const referralCode =
      normalizeReferralCode(body.referralCode) ||
      cookieRef ||
      null;

    const user = await registerUser({
      email: body.email || "",
      password: body.password || "",
      name: body.name,
      referralCode,
    });
    return NextResponse.json({ user, referralApplied: Boolean(referralCode) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Signup failed" },
      { status: 400 },
    );
  }
}
