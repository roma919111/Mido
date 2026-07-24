import { localStore } from "@/lib/db/local-store";
import { creditsForTier } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  CreditTransaction,
  GenerationRecord,
  SubscriptionTier,
  UserProfile,
} from "@/lib/types";

function mapGeneration(row: Record<string, unknown>, likedByMe = false): GenerationRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id ?? row.userId),
    mode: row.mode as GenerationRecord["mode"],
    mediaType: row.media_type as GenerationRecord["mediaType"],
    prompt: String(row.prompt ?? ""),
    negativePrompt: (row.negative_prompt as string | null) ?? null,
    stylePreset: (row.style_preset as string | null) ?? null,
    aspectRatio: (row.aspect_ratio as string | null) ?? null,
    duration: (row.duration as number | null) ?? null,
    resolution: (row.resolution as string | null) ?? null,
    settings: (row.settings as Record<string, unknown>) ?? {},
    mediaUrl: (row.media_url as string | null) ?? null,
    thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
    historyId: (row.history_id as string | null) ?? null,
    status: (row.status as GenerationRecord["status"]) ?? "pending",
    creditsUsed: Number(row.credits_used ?? 0),
    isPublic: Boolean(row.is_public),
    likesCount: Number(row.likes_count ?? 0),
    likedByMe,
    error: (row.error as string | null) ?? null,
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
    authorName:
      ((row.users as { full_name?: string } | undefined)?.full_name as string | undefined) ??
      (row.authorName as string | undefined),
  };
}

export const repository = {
  async deductCredits(
    userId: string,
    amount: number,
    reason: string,
    metadata: Record<string, unknown> = {},
  ) {
    if (!isSupabaseConfigured()) {
      return localStore.deductCredits(userId, amount, reason, metadata);
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("deduct_credits", {
      p_user_id: userId,
      p_amount: amount,
      p_reason: reason,
      p_metadata: metadata,
    });

    if (error) throw new Error(error.message);
    return Number(data);
  },

  async refundCredits(userId: string, amount: number, reason: string) {
    if (!isSupabaseConfigured()) {
      return localStore.refundCredits(userId, amount, reason);
    }

    const admin = createAdminClient();
    const { data: current, error: readError } = await admin
      .from("user_credits")
      .select("balance")
      .eq("user_id", userId)
      .single();
    if (readError) throw new Error(readError.message);

    const next = Number(current.balance) + amount;
    const { error } = await admin
      .from("user_credits")
      .update({ balance: next, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    await admin.from("credit_transactions").insert({
      user_id: userId,
      amount,
      balance_after: next,
      reason,
    });

    return next;
  },

  async createGeneration(
    input: Omit<GenerationRecord, "id" | "createdAt" | "likesCount"> & {
      likesCount?: number;
    },
  ) {
    if (!isSupabaseConfigured()) {
      return localStore.createGeneration(input);
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("user_generations")
      .insert({
        user_id: input.userId,
        mode: input.mode,
        media_type: input.mediaType,
        prompt: input.prompt,
        negative_prompt: input.negativePrompt,
        style_preset: input.stylePreset,
        aspect_ratio: input.aspectRatio,
        duration: input.duration,
        resolution: input.resolution,
        settings: input.settings ?? {},
        media_url: input.mediaUrl,
        thumbnail_url: input.thumbnailUrl,
        history_id: input.historyId,
        status: input.status,
        credits_used: input.creditsUsed,
        is_public: input.isPublic,
        error: input.error,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return mapGeneration(data);
  },

  async updateGeneration(id: string, patch: Partial<GenerationRecord>) {
    if (!isSupabaseConfigured()) {
      return localStore.updateGeneration(id, patch);
    }

    const admin = createAdminClient();
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.mediaUrl !== undefined) payload.media_url = patch.mediaUrl;
    if (patch.thumbnailUrl !== undefined) payload.thumbnail_url = patch.thumbnailUrl;
    if (patch.historyId !== undefined) payload.history_id = patch.historyId;
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.error !== undefined) payload.error = patch.error;
    if (patch.isPublic !== undefined) payload.is_public = patch.isPublic;
    if (patch.settings !== undefined) payload.settings = patch.settings;

    const { data, error } = await admin
      .from("user_generations")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapGeneration(data);
  },

  async listGenerations(options: {
    userId?: string;
    publicOnly?: boolean;
    viewerId?: string;
    limit?: number;
  }) {
    if (!isSupabaseConfigured()) {
      return localStore.listGenerations(options);
    }

    const admin = createAdminClient();
    let query = admin
      .from("user_generations")
      .select("*, users(full_name)")
      .order("created_at", { ascending: false })
      .limit(options.limit ?? 40);

    if (options.publicOnly) query = query.eq("is_public", true).eq("status", "completed");
    if (options.userId) query = query.eq("user_id", options.userId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let likedIds = new Set<string>();
    if (options.viewerId) {
      const { data: likes } = await admin
        .from("generation_favorites")
        .select("generation_id")
        .eq("user_id", options.viewerId);
      likedIds = new Set((likes ?? []).map((l) => String(l.generation_id)));
    }

    return (data ?? []).map((row) => mapGeneration(row, likedIds.has(String(row.id))));
  },

  async listTransactions(userId: string, limit = 20): Promise<CreditTransaction[]> {
    if (!isSupabaseConfigured()) {
      return localStore.getTransactions(userId, limit);
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("credit_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      amount: Number(row.amount),
      balanceAfter: Number(row.balance_after),
      reason: String(row.reason),
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: String(row.created_at),
    }));
  },

  async toggleFavorite(userId: string, generationId: string) {
    if (!isSupabaseConfigured()) {
      return localStore.toggleFavorite(userId, generationId);
    }

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("generation_favorites")
      .select("user_id")
      .eq("user_id", userId)
      .eq("generation_id", generationId)
      .maybeSingle();

    if (existing) {
      await admin
        .from("generation_favorites")
        .delete()
        .eq("user_id", userId)
        .eq("generation_id", generationId);
      const { data: gen } = await admin
        .from("user_generations")
        .select("likes_count")
        .eq("id", generationId)
        .single();
      const next = Math.max(0, Number(gen?.likes_count ?? 1) - 1);
      await admin.from("user_generations").update({ likes_count: next }).eq("id", generationId);
      return { liked: false, likesCount: next };
    }

    await admin.from("generation_favorites").insert({
      user_id: userId,
      generation_id: generationId,
    });
    const { data: gen } = await admin
      .from("user_generations")
      .select("likes_count")
      .eq("id", generationId)
      .single();
    const next = Number(gen?.likes_count ?? 0) + 1;
    await admin.from("user_generations").update({ likes_count: next }).eq("id", generationId);
    return { liked: true, likesCount: next };
  },

  async upgradeTier(user: UserProfile, tier: SubscriptionTier): Promise<UserProfile> {
    if (!isSupabaseConfigured()) {
      return localStore.updateProfile(user.id, { subscriptionTier: tier });
    }

    const admin = createAdminClient();
    const grant = creditsForTier(tier);

    await admin
      .from("users")
      .update({
        subscription_tier: tier,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    const { data: credits } = await admin
      .from("user_credits")
      .select("balance")
      .eq("user_id", user.id)
      .single();

    const next = Number(credits?.balance ?? 0) + grant;
    await admin
      .from("user_credits")
      .update({ balance: next, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    await admin.from("credit_transactions").insert({
      user_id: user.id,
      amount: grant,
      balance_after: next,
      reason: `upgrade_${tier}`,
    });

    return {
      ...user,
      subscriptionTier: tier,
      credits: next,
    };
  },
};
