import { NextResponse } from "next/server";
import { getCurrentUser, publicUser } from "@/lib/customer-auth";
import { reconcileCustomerWallet } from "@/lib/wallet-reconcile";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null, authenticated: false });
  }

  if (user.locked) {
    return NextResponse.json({
      user: publicUser(user),
      authenticated: true,
      locked: true,
      error:
        user.lockedReason?.trim() ||
        "تم إيقاف هذا الحساب. تواصل مع الدعم.",
    });
  }

  // Sync plan from Stripe if needed. Never refills spent credits on return.
  const { user: synced, restored, appliedSessions } = await reconcileCustomerWallet(user);

  return NextResponse.json({
    user: publicUser(synced),
    authenticated: true,
    walletRestored: restored,
    appliedSessions,
  });
}
