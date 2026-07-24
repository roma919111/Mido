import { NextResponse } from "next/server";
import { setLocalSessionCookie } from "@/lib/auth/session";
import { localStore } from "@/lib/db/local-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      fullName?: string;
    };

    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    const fullName = body.fullName?.trim() || email?.split("@")[0] || "Creator";

    if (!email || password.length < 6) {
      return NextResponse.json(
        { error: "Email and a password of at least 6 characters are required" },
        { status: 400 },
      );
    }

    if (isSupabaseConfigured()) {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({
        user: {
          id: data.user?.id,
          email,
          fullName,
          subscriptionTier: "free",
          credits: 50,
        },
        mode: "supabase",
      });
    }

    const profile = localStore.signup({ email, password, fullName });
    const { token } = localStore.signin(email, password);
    await setLocalSessionCookie(token);

    return NextResponse.json({ user: profile, mode: "local" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Signup failed" },
      { status: 400 },
    );
  }
}
