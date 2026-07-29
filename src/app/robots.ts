import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/setup/", "/assets"],
    },
    sitemap: "https://vyronix.app/sitemap.xml",
    host: "https://vyronix.app",
  };
}
