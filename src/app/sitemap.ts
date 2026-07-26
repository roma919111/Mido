import type { MetadataRoute } from "next";

const BASE = "https://vyronix.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const paths = [
    "/",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
    "/pricing",
    "/login",
    "/signup",
  ];
  return paths.map((path, i) => ({
    url: `${BASE}${path === "/" ? "" : path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority: path === "/" ? 1 : Math.max(0.5, 0.9 - i * 0.05),
  }));
}
