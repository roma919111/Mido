import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({
    user,
    authMode: isSupabaseConfigured() ? "supabase" : "local",
  });
}
