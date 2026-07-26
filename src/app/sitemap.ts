import type { MetadataRoute } from "next";

const BASE = "https://vyronix.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: Array<{
    path: string;
    changeFrequency: "daily" | "weekly" | "monthly";
    priority: number;
  }> = [
    { path: "/", changeFrequency: "daily", priority: 1 },
    { path: "/pricing", changeFrequency: "weekly", priority: 0.9 },
    { path: "/about", changeFrequency: "monthly", priority: 0.8 },
    { path: "/faq", changeFrequency: "weekly", priority: 0.8 },
    { path: "/contact", changeFrequency: "monthly", priority: 0.7 },
    { path: "/privacy", changeFrequency: "monthly", priority: 0.6 },
    { path: "/terms", changeFrequency: "monthly", priority: 0.6 },
    { path: "/login", changeFrequency: "monthly", priority: 0.5 },
    { path: "/signup", changeFrequency: "monthly", priority: 0.5 },
  ];
  return entries.map((entry) => ({
    url: `${BASE}${entry.path === "/" ? "" : entry.path}`,
    lastModified: now,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));
}
