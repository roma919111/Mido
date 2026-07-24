import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { repository } from "@/lib/db/repository";
import type { SubscriptionTier } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const transactions = await repository.listTransactions(user.id, 30);
  return NextResponse.json({
    balance: user.credits,
    tier: user.subscriptionTier,
    transactions,
  });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as { tier?: SubscriptionTier };
    if (!body.tier || !["free", "pro", "master"].includes(body.tier)) {
      return NextResponse.json({ error: "Valid tier is required" }, { status: 400 });
    }

    const updated = await repository.upgradeTier(user, body.tier);
    return NextResponse.json({ user: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upgrade failed" },
      { status: 400 },
    );
  }
}
