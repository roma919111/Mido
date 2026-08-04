import type { CatalogItem } from "../types";

/**
 * Curated catalog — each link points to the official platform page.
 * Playback always happens on Netflix / Shahid / TOD (browser or native app).
 * Add items by editing this file or loading from your CMS later.
 */
export const CATALOG: CatalogItem[] = [
  {
    id: "breaking-bad",
    title: "بريكنغ باد",
    titleEn: "Breaking Bad",
    description: "دراما · 5 مواسم",
    category: "series",
    posterGradient: "linear-gradient(135deg, #14532d 0%, #052e16 100%)",
    platforms: [
      {
        platform: "netflix",
        url: "https://www.netflix.com/title/70143836",
      },
    ],
  },
  {
    id: "money-heist",
    title: "لا كاسا دي بapel",
    titleEn: "Money Heist",
    description: "إثارة · مسلسل",
    category: "series",
    posterGradient: "linear-gradient(135deg, #7f1d1d 0%, #450a0a 100%)",
    platforms: [
      {
        platform: "netflix",
        url: "https://www.netflix.com/title/80192098",
      },
    ],
  },
  {
    id: "al-hashashin",
    title: "الحشاشين",
    description: "دراما تاريخية · شاهد أصلي",
    category: "series",
    posterGradient: "linear-gradient(135deg, #78350f 0%, #422006 100%)",
    platforms: [
      {
        platform: "shahid",
        url: "https://shahid.mbc.net/ar",
      },
    ],
  },
  {
    id: "world-cup",
    title: "مباريات كرة القدم",
    description: "رياضة · بث مباشر",
    category: "sport",
    posterGradient: "linear-gradient(135deg, #1e3a8a 0%, #172554 100%)",
    platforms: [
      {
        platform: "tod",
        url: "https://www.tod.tv/ar",
      },
      {
        platform: "shahid",
        url: "https://shahid.mbc.net/ar/sports",
      },
    ],
  },
  {
    id: "spider-verse",
    title: "Spider-Man: Across the Spider-Verse",
    titleEn: "Spider-Verse",
    description: "رسوم متحركة · عائلي",
    category: "kids",
    posterGradient: "linear-gradient(135deg, #312e81 0%, #1e1b4b 100%)",
    platforms: [
      {
        platform: "netflix",
        url: "https://www.netflix.com/browse/genre/783",
      },
    ],
  },
  {
    id: "documentary",
    title: "وثائقيات مميزة",
    description: "اكتشف وثائقيات على منصات متعددة",
    category: "movie",
    posterGradient: "linear-gradient(135deg, #0f766e 0%, #134e4a 100%)",
    platforms: [
      {
        platform: "netflix",
        url: "https://www.netflix.com/browse/genre/683",
      },
      {
        platform: "shahid",
        url: "https://shahid.mbc.net/ar",
      },
    ],
  },
];

export const CATEGORIES = [
  { id: "all", label: "الكل" },
  { id: "series", label: "مسلسلات" },
  { id: "movie", label: "أفلام" },
  { id: "sport", label: "رياضة" },
  { id: "kids", label: "أطفال" },
] as const;
