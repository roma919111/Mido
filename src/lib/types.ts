export type GenerationMode = "text-to-image" | "text-to-video" | "image-to-video";

export type VideoDuration = 5 | 10;

export type VideoQuality = "standard" | "pro";

export type MediaType = "image" | "video";

export type GenerationProvider = "gemini";

export interface VisualReference {
  type: "image";
  id: string;
  url: string;
  label: string;
  metadata?: Record<string, unknown>;
}

export interface GalleryItem {
  id: string;
  historyId: string;
  mediaType: MediaType;
  url: string;
  playbackUrl?: string;
  thumbnailUrl?: string;
  prompt: string;
  mode: GenerationMode;
  createdAt: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  error?: string;
  creditsUsed?: number;
  provider?: GenerationProvider;
}

export interface AccountInfo {
  email?: string;
  plan?: string;
  credits: number;
  configured: boolean;
  live?: boolean;
  provider?: GenerationProvider;
  error?: string;
}

export interface GenerateRequest {
  mode: GenerationMode;
  prompt: string;
  duration?: VideoDuration;
  quality?: VideoQuality;
  startFrame?: VisualReference | null;
  referenceImage?: VisualReference | null;
  waitForResult?: boolean;
}

export interface GenerateResponse {
  historyId: string;
  status: string;
  mediaType: MediaType;
  mode: GenerationMode;
  prompt: string;
  creditsUsed: number;
  urls?: string[];
  url?: string;
  playbackUrl?: string;
  thumbnailUrl?: string;
  provider?: GenerationProvider;
  error?: string;
  pollAfterSeconds?: number;
  live?: boolean;
  tool?: string;
  details?: unknown;
  raw?: unknown;
}
