import type { MetadataRoute } from "next";
import { allModelSlugs } from "@/lib/model-seo";

import { ALL_SEO_LANDING_SLUGS } from "@/lib/seo-landings";

const BASE = "https://vyronix.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: Array<{
    path: string;
    changeFrequency: "daily" | "weekly" | "monthly";
    priority: number;
  }> = [
    { path: "/", changeFrequency: "daily", priority: 1 },
    { path: "/models", changeFrequency: "weekly", priority: 0.95 },
    { path: "/create/video", changeFrequency: "daily", priority: 0.95 },
    { path: "/edit", changeFrequency: "weekly", priority: 0.9 },
    { path: "/inspire", changeFrequency: "weekly", priority: 0.85 },
    { path: "/directors", changeFrequency: "weekly", priority: 0.85 },
    { path: "/create/image", changeFrequency: "daily", priority: 0.95 },
    { path: "/invite", changeFrequency: "weekly", priority: 0.85 },
    { path: "/pricing", changeFrequency: "weekly", priority: 0.9 },
    { path: "/maxmediaplayer", changeFrequency: "weekly", priority: 0.9 },
    { path: "/max", changeFrequency: "weekly", priority: 0.9 },
    { path: "/tools", changeFrequency: "weekly", priority: 0.8 },
    { path: "/about", changeFrequency: "monthly", priority: 0.8 },
    { path: "/faq", changeFrequency: "weekly", priority: 0.8 },
    { path: "/contact", changeFrequency: "monthly", priority: 0.7 },
    { path: "/privacy", changeFrequency: "monthly", priority: 0.6 },
    { path: "/terms", changeFrequency: "monthly", priority: 0.6 },
    { path: "/login", changeFrequency: "monthly", priority: 0.5 },
    { path: "/signup", changeFrequency: "monthly", priority: 0.5 },
    ...ALL_SEO_LANDING_SLUGS.map((slug) => ({
      path: `/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.88,
    })),
    ...allModelSlugs().map((slug) => ({
      path: `/models/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.88,
    })),
  ];
  return entries.map((entry) => ({
    url: `${BASE}${entry.path === "/" ? "" : entry.path}`,
    lastModified: now,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));
}
