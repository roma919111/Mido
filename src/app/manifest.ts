import type { MetadataRoute } from "next";
import { OG_IMAGE_PATH, SITE_NAME, SITE_URL } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "Veronix",
    description:
      "AI image and video studio — free first video, credit wallet, and plans on vyronix.app",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0d12",
    theme_color: "#0b0d12",
    lang: "ar",
    dir: "rtl",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: OG_IMAGE_PATH,
        sizes: "1536x1024",
        type: "image/png",
        purpose: "any",
      },
    ],
    categories: ["entertainment", "photo", "productivity"],
    id: SITE_URL,
  };
}
