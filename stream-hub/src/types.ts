export type PlatformId = "netflix" | "shahid" | "tod";

export type PlatformLink = {
  platform: PlatformId;
  /** Official web URL or app deep link — opens externally (Custom Tabs / browser). */
  url: string;
  label?: string;
};

export type CatalogItem = {
  id: string;
  title: string;
  titleEn?: string;
  description: string;
  category: "movie" | "series" | "sport" | "kids";
  posterGradient: string;
  platforms: PlatformLink[];
};

export type Session = {
  username: string;
  issuedAt: number;
};
