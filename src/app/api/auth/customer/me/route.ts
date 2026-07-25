import { NextResponse } from "next/server";
import { getCurrentUser, publicUser } from "@/lib/customer-auth";
import { reconcileCustomerWallet } from "@/lib/wallet-reconcile";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null, authenticated: false });
  }

  // Recover paid plan/credits from Stripe if local wallet was lost.
  const { user: synced, restored, appliedSessions } = await reconcileCustomerWallet(user);

  return NextResponse.json({
    user: publicUser(synced),
    authenticated: true,
    walletRestored: restored,
    appliedSessions,
  });
}
