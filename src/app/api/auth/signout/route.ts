import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { LOCAL_SESSION_COOKIE } from "@/lib/auth/constants";
import { clearLocalSessionCookie } from "@/lib/auth/session";
import { localStore } from "@/lib/db/local-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    if (isSupabaseConfigured()) {
      const supabase = await createClient();
      await supabase.auth.signOut();
      return NextResponse.json({ ok: true, mode: "supabase" });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get(LOCAL_SESSION_COOKIE)?.value;
    localStore.signout(token);
    await clearLocalSessionCookie();
    return NextResponse.json({ ok: true, mode: "local" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sign out failed" },
      { status: 500 },
    );
  }
}
