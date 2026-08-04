export type PlatformId = "netflix" | "shahid" | "tod";

export type PlatformLink = {
  platform: PlatformId;
  url: string;
  label?: string;
};

export type CatalogItem = {
  id: string;
  title: string;
  titleEn?: string;
  synopsis: string;
  description: string;
  category: "movie" | "series" | "sport" | "kids";
  year?: number;
  rating?: string;
  featured?: boolean;
  posterGradient: string;
  /** Optional YouTube trailer — plays inside the app (preview only). */
  trailerYoutubeId?: string;
  platforms: PlatformLink[];
};

export type Session = {
  username: string;
  issuedAt: number;
};

export type ContinueEntry = {
  itemId: string;
  title: string;
  posterGradient: string;
  platform: PlatformId;
  url: string;
  watchedAt: number;
};

export type LaunchState = {
  platform: PlatformId;
  platformName: string;
  title: string;
  url: string;
  launchMode: "android-app" | "app-link" | "browser";
  launchLabel: string;
};
