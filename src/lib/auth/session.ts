import { cookies } from "next/headers";
import { LOCAL_SESSION_COOKIE } from "@/lib/auth/constants";
import { localStore } from "@/lib/db/local-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { SubscriptionTier, UserProfile } from "@/lib/types";

export { LOCAL_SESSION_COOKIE };

export async function getCurrentUser(): Promise<UserProfile | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const admin = createAdminClient();
      const { data: profile } = await admin
        .from("users")
        .select("id,email,full_name,avatar_url,subscription_tier")
        .eq("id", user.id)
        .maybeSingle();

      const { data: credits } = await admin
        .from("user_credits")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();

      return {
        id: user.id,
        email: profile?.email ?? user.email ?? "",
        fullName:
          profile?.full_name ??
          (user.user_metadata?.full_name as string | undefined) ??
          user.email?.split("@")[0] ??
          "Creator",
        avatarUrl: profile?.avatar_url ?? null,
        subscriptionTier: (profile?.subscription_tier as SubscriptionTier) ?? "free",
        credits: credits?.balance ?? 0,
      };
    } catch {
      return null;
    }
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(LOCAL_SESSION_COOKIE)?.value;
  return localStore.getSessionUser(token);
}

export async function requireUser(): Promise<UserProfile> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Authentication required");
  }
  return user;
}

export async function setLocalSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(LOCAL_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearLocalSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(LOCAL_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
