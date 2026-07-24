import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { localStore } from "@/lib/db/local-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as { fullName?: string; avatarUrl?: string };
    const fullName = body.fullName?.trim();

    if (isSupabaseConfigured()) {
      const admin = createAdminClient();
      const { error } = await admin
        .from("users")
        .update({
          full_name: fullName ?? user.fullName,
          avatar_url: body.avatarUrl ?? user.avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (error) throw new Error(error.message);
      return NextResponse.json({
        user: {
          ...user,
          fullName: fullName ?? user.fullName,
          avatarUrl: body.avatarUrl ?? user.avatarUrl,
        },
      });
    }

    const updated = localStore.updateProfile(user.id, {
      fullName: fullName ?? user.fullName,
      avatarUrl: body.avatarUrl ?? user.avatarUrl,
    });
    return NextResponse.json({ user: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Profile update failed" },
      { status: 400 },
    );
  }
}
