import { NextResponse } from "next/server";
import { localStore } from "@/lib/db/local-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      mode?: "request" | "update";
    };

    const email = body.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (isSupabaseConfigured()) {
      const supabase = await createClient();
      if (body.mode === "update" && body.password) {
        const { error } = await supabase.auth.updateUser({ password: body.password });
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, mode: "supabase" });
      }

      const origin = new URL(request.url).origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/reset-password`,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true, mode: "supabase" });
    }

    if (!body.password || body.password.length < 6) {
      return NextResponse.json(
        { error: "In local mode, provide a new password (min 6 characters)" },
        { status: 400 },
      );
    }

    localStore.resetPassword(email, body.password);
    return NextResponse.json({ ok: true, mode: "local" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reset failed" },
      { status: 400 },
    );
  }
}
