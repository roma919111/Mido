import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { repository } from "@/lib/db/repository";
import { isOpenArtConfigured } from "@/lib/openart-mcp";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({
      configured: false,
      authenticated: false,
      credits: 0,
      plan: "Guest",
      openArtConfigured: isOpenArtConfigured(),
      supabaseConfigured: isSupabaseConfigured(),
    });
  }

  const transactions = await repository.listTransactions(user.id, 8);

  return NextResponse.json({
    configured: true,
    authenticated: true,
    credits: user.credits,
    plan: user.subscriptionTier,
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    openArtConfigured: isOpenArtConfigured(),
    supabaseConfigured: isSupabaseConfigured(),
    transactions,
  });
}
