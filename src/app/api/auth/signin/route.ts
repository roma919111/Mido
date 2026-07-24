import { NextResponse } from "next/server";
import { setLocalSessionCookie } from "@/lib/auth/session";
import { localStore } from "@/lib/db/local-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    if (isSupabaseConfigured()) {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      return NextResponse.json({
        user: {
          id: data.user.id,
          email: data.user.email,
          fullName: data.user.user_metadata?.full_name ?? email.split("@")[0],
        },
        mode: "supabase",
      });
    }

    const { profile, token } = localStore.signin(email, password);
    await setLocalSessionCookie(token);
    return NextResponse.json({ user: profile, mode: "local" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sign in failed" },
      { status: 401 },
    );
  }
}
