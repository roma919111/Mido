export type GenerationMode =
  | "text-to-image"
  | "text-to-video"
  | "image-to-video"
  | "inpaint";

export type SubscriptionTier = "free" | "pro" | "master";
export type MediaType = "image" | "video";
export type VideoDuration = 5 | 10;
export type VideoQuality = "standard" | "pro";
export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3";
export type StylePreset =
  | "none"
  | "cinematic"
  | "anime"
  | "photorealistic"
  | "cyberpunk"
  | "3d-render";

export interface VisualReference {
  type: "image";
  id: string;
  url: string;
  label: string;
  metadata?: Record<string, unknown>;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  subscriptionTier: SubscriptionTier;
  credits: number;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number;
  balanceAfter: number;
  reason: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface GenerationRecord {
  id: string;
  userId: string;
  mode: GenerationMode;
  mediaType: MediaType;
  prompt: string;
  negativePrompt?: string | null;
  stylePreset?: StylePreset | string | null;
  aspectRatio?: AspectRatio | string | null;
  duration?: number | null;
  resolution?: string | null;
  settings?: Record<string, unknown>;
  mediaUrl?: string | null;
  thumbnailUrl?: string | null;
  historyId?: string | null;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  creditsUsed: number;
  isPublic: boolean;
  likesCount: number;
  likedByMe?: boolean;
  error?: string | null;
  createdAt: string;
  authorName?: string;
}

export interface GenerateRequest {
  mode: GenerationMode;
  prompt: string;
  negativePrompt?: string;
  stylePreset?: StylePreset;
  aspectRatio?: AspectRatio;
  duration?: VideoDuration;
  quality?: VideoQuality;
  startFrame?: VisualReference | null;
  referenceImage?: VisualReference | null;
  isPublic?: boolean;
  waitForResult?: boolean;
}

export interface PricingTier {
  id: SubscriptionTier;
  name: string;
  price: number;
  credits: number;
  description: string;
  features: string[];
  highlighted?: boolean;
}
