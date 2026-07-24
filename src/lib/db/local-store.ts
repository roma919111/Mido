import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { creditsForTier } from "@/lib/pricing";
import type {
  CreditTransaction,
  GenerationRecord,
  SubscriptionTier,
  UserProfile,
} from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "studio-db.json");

interface LocalUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  subscriptionTier: SubscriptionTier;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
}

interface LocalSession {
  token: string;
  userId: string;
  expiresAt: string;
}

interface LocalDb {
  users: LocalUser[];
  credits: Record<string, number>;
  transactions: CreditTransaction[];
  generations: GenerationRecord[];
  favorites: Array<{ userId: string; generationId: string; createdAt: string }>;
  sessions: LocalSession[];
}

function emptyDb(): LocalDb {
  return {
    users: [],
    credits: {},
    transactions: [],
    generations: [],
    favorites: [],
    sessions: [],
  };
}

function ensureDb(): LocalDb {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DB_PATH)) {
    const seeded = seedCommunity(emptyDb());
    writeFileSync(DB_PATH, JSON.stringify(seeded, null, 2));
    return seeded;
  }
  return JSON.parse(readFileSync(DB_PATH, "utf8")) as LocalDb;
}

function saveDb(db: LocalDb) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(password: string, salt: string, hash: string) {
  const hashed = Buffer.from(hashPassword(password, salt), "hex");
  const target = Buffer.from(hash, "hex");
  if (hashed.length !== target.length) return false;
  return timingSafeEqual(hashed, target);
}

function seedCommunity(db: LocalDb): LocalDb {
  const communityUser: LocalUser = {
    id: "community-curator",
    email: "curator@studio.ai",
    fullName: "Studio Curator",
    subscriptionTier: "pro",
    passwordHash: "x",
    passwordSalt: "x",
    createdAt: new Date().toISOString(),
  };

  db.users.push(communityUser);
  db.credits[communityUser.id] = 1000;

  const samples: Array<Omit<GenerationRecord, "id" | "createdAt">> = [
    {
      userId: communityUser.id,
      mode: "text-to-image",
      mediaType: "image",
      prompt: "Neon samurai standing in rainy Tokyo alley, cinematic rim light",
      stylePreset: "cyberpunk",
      aspectRatio: "9:16",
      mediaUrl:
        "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=900&q=80",
      status: "completed",
      creditsUsed: 2,
      isPublic: true,
      likesCount: 128,
      authorName: "Studio Curator",
    },
    {
      userId: communityUser.id,
      mode: "text-to-image",
      mediaType: "image",
      prompt: "Photoreal portrait of an astronaut with golden hour reflections",
      stylePreset: "photorealistic",
      aspectRatio: "1:1",
      mediaUrl:
        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=900&q=80",
      status: "completed",
      creditsUsed: 2,
      isPublic: true,
      likesCount: 86,
      authorName: "Studio Curator",
    },
    {
      userId: communityUser.id,
      mode: "text-to-video",
      mediaType: "video",
      prompt: "Aerial glide over misty emerald mountains at sunrise",
      stylePreset: "cinematic",
      aspectRatio: "16:9",
      duration: 5,
      resolution: "720p",
      mediaUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=80",
      status: "completed",
      creditsUsed: 10,
      isPublic: true,
      likesCount: 204,
      authorName: "Studio Curator",
    },
    {
      userId: communityUser.id,
      mode: "text-to-image",
      mediaType: "image",
      prompt: "Anime heroine on a rooftop under cherry blossom petals",
      stylePreset: "anime",
      aspectRatio: "4:3",
      mediaUrl:
        "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=900&q=80",
      status: "completed",
      creditsUsed: 2,
      isPublic: true,
      likesCount: 67,
      authorName: "Studio Curator",
    },
  ];

  for (const sample of samples) {
    db.generations.push({
      ...sample,
      id: uuidv4(),
      createdAt: new Date(Date.now() - Math.random() * 86_400_000).toISOString(),
    });
  }

  return db;
}

function toProfile(user: LocalUser, credits: number): UserProfile {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    subscriptionTier: user.subscriptionTier,
    credits,
  };
}

export const localStore = {
  signup(input: { email: string; password: string; fullName: string }): UserProfile {
    const db = ensureDb();
    const email = input.email.trim().toLowerCase();
    if (db.users.some((u) => u.email === email)) {
      throw new Error("An account with this email already exists");
    }

    const salt = randomBytes(16).toString("hex");
    const user: LocalUser = {
      id: uuidv4(),
      email,
      fullName: input.fullName.trim() || email.split("@")[0],
      subscriptionTier: "free",
      passwordHash: hashPassword(input.password, salt),
      passwordSalt: salt,
      createdAt: new Date().toISOString(),
    };

    db.users.push(user);
    db.credits[user.id] = 50;
    db.transactions.push({
      id: uuidv4(),
      userId: user.id,
      amount: 50,
      balanceAfter: 50,
      reason: "signup_bonus",
      createdAt: new Date().toISOString(),
    });
    saveDb(db);
    return toProfile(user, 50);
  },

  signin(email: string, password: string): { profile: UserProfile; token: string } {
    const db = ensureDb();
    const user = db.users.find((u) => u.email === email.trim().toLowerCase());
    if (!user || user.id === "community-curator") {
      throw new Error("Invalid email or password");
    }
    if (!verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      throw new Error("Invalid email or password");
    }

    const token = randomBytes(24).toString("hex");
    db.sessions = db.sessions.filter((s) => s.userId !== user.id);
    db.sessions.push({
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
    });
    saveDb(db);

    return {
      profile: toProfile(user, db.credits[user.id] ?? 0),
      token,
    };
  },

  signout(token?: string | null) {
    if (!token) return;
    const db = ensureDb();
    db.sessions = db.sessions.filter((s) => s.token !== token);
    saveDb(db);
  },

  getSessionUser(token?: string | null): UserProfile | null {
    if (!token) return null;
    const db = ensureDb();
    const session = db.sessions.find((s) => s.token === token);
    if (!session || new Date(session.expiresAt).getTime() < Date.now()) return null;
    const user = db.users.find((u) => u.id === session.userId);
    if (!user) return null;
    return toProfile(user, db.credits[user.id] ?? 0);
  },

  resetPassword(email: string, newPassword: string) {
    const db = ensureDb();
    const user = db.users.find((u) => u.email === email.trim().toLowerCase());
    if (!user || user.id === "community-curator") {
      throw new Error("No account found for that email");
    }
    const salt = randomBytes(16).toString("hex");
    user.passwordSalt = salt;
    user.passwordHash = hashPassword(newPassword, salt);
    saveDb(db);
    return true;
  },

  updateProfile(
    userId: string,
    patch: Partial<Pick<UserProfile, "fullName" | "avatarUrl" | "subscriptionTier">>,
  ): UserProfile {
    const db = ensureDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new Error("User not found");
    if (patch.fullName !== undefined) user.fullName = patch.fullName;
    if (patch.avatarUrl !== undefined) user.avatarUrl = patch.avatarUrl;
    if (patch.subscriptionTier !== undefined) {
      user.subscriptionTier = patch.subscriptionTier;
      const grant = creditsForTier(patch.subscriptionTier);
      db.credits[user.id] = (db.credits[user.id] ?? 0) + grant;
      db.transactions.push({
        id: uuidv4(),
        userId: user.id,
        amount: grant,
        balanceAfter: db.credits[user.id],
        reason: `upgrade_${patch.subscriptionTier}`,
        createdAt: new Date().toISOString(),
      });
    }
    saveDb(db);
    return toProfile(user, db.credits[user.id] ?? 0);
  },

  getCredits(userId: string) {
    const db = ensureDb();
    return db.credits[userId] ?? 0;
  },

  getTransactions(userId: string, limit = 20) {
    const db = ensureDb();
    return db.transactions
      .filter((t) => t.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  },

  deductCredits(
    userId: string,
    amount: number,
    reason: string,
    metadata: Record<string, unknown> = {},
  ) {
    const db = ensureDb();
    const balance = db.credits[userId] ?? 0;
    if (balance < amount) throw new Error("Insufficient credits");
    const next = balance - amount;
    db.credits[userId] = next;
    db.transactions.push({
      id: uuidv4(),
      userId,
      amount: -amount,
      balanceAfter: next,
      reason,
      metadata,
      createdAt: new Date().toISOString(),
    });
    saveDb(db);
    return next;
  },

  refundCredits(userId: string, amount: number, reason: string) {
    const db = ensureDb();
    const next = (db.credits[userId] ?? 0) + amount;
    db.credits[userId] = next;
    db.transactions.push({
      id: uuidv4(),
      userId,
      amount,
      balanceAfter: next,
      reason,
      createdAt: new Date().toISOString(),
    });
    saveDb(db);
    return next;
  },

  createGeneration(
    record: Omit<GenerationRecord, "id" | "createdAt" | "likesCount"> & {
      likesCount?: number;
    },
  ): GenerationRecord {
    const db = ensureDb();
    const user = db.users.find((u) => u.id === record.userId);
    const row: GenerationRecord = {
      ...record,
      id: uuidv4(),
      likesCount: record.likesCount ?? 0,
      authorName: user?.fullName,
      createdAt: new Date().toISOString(),
    };
    db.generations.unshift(row);
    saveDb(db);
    return row;
  },

  updateGeneration(id: string, patch: Partial<GenerationRecord>) {
    const db = ensureDb();
    const idx = db.generations.findIndex((g) => g.id === id);
    if (idx < 0) throw new Error("Generation not found");
    db.generations[idx] = { ...db.generations[idx], ...patch, id };
    saveDb(db);
    return db.generations[idx];
  },

  listGenerations(options: {
    userId?: string;
    publicOnly?: boolean;
    viewerId?: string;
    limit?: number;
  }) {
    const db = ensureDb();
    let rows = [...db.generations];
    if (options.publicOnly) rows = rows.filter((g) => g.isPublic && g.status === "completed");
    if (options.userId) rows = rows.filter((g) => g.userId === options.userId);
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const limit = options.limit ?? 40;
    return rows.slice(0, limit).map((g) => ({
      ...g,
      likedByMe: options.viewerId
        ? db.favorites.some((f) => f.userId === options.viewerId && f.generationId === g.id)
        : false,
    }));
  },

  toggleFavorite(userId: string, generationId: string) {
    const db = ensureDb();
    const existing = db.favorites.findIndex(
      (f) => f.userId === userId && f.generationId === generationId,
    );
    const generation = db.generations.find((g) => g.id === generationId);
    if (!generation) throw new Error("Generation not found");

    let liked = false;
    if (existing >= 0) {
      db.favorites.splice(existing, 1);
      generation.likesCount = Math.max(0, generation.likesCount - 1);
      liked = false;
    } else {
      db.favorites.push({
        userId,
        generationId,
        createdAt: new Date().toISOString(),
      });
      generation.likesCount += 1;
      liked = true;
    }
    saveDb(db);
    return { liked, likesCount: generation.likesCount };
  },

  demoTokenFingerprint(token: string) {
    return createHash("sha256").update(token).digest("hex").slice(0, 12);
  },
};
