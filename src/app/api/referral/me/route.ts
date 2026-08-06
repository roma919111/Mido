import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { ensureUserReferralCode, referralStats } from "@/lib/referral";
import { findUserById, publicUser } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const code = await ensureUserReferralCode(user.id);
  const fresh = (await findUserById(user.id)) || user;
  return NextResponse.json({
    user: publicUser({ ...fresh, referralCode: code }),
    referral: referralStats({ ...fresh, referralCode: code }),
  });
}
