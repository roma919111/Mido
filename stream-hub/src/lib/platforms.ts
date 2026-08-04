import type { PlatformId } from "../types";

export type PlatformMeta = {
  id: PlatformId;
  name: string;
  color: string;
  /** Opens official site in external browser — no embedded playback. */
  homeUrl: string;
};

export const PLATFORMS: Record<PlatformId, PlatformMeta> = {
  netflix: {
    id: "netflix",
    name: "Netflix",
    color: "#e50914",
    homeUrl: "https://www.netflix.com/browse",
  },
  shahid: {
    id: "shahid",
    name: "شاهد",
    color: "#00c853",
    homeUrl: "https://shahid.mbc.net/ar",
  },
  tod: {
    id: "tod",
    name: "TOD",
    color: "#7c3aed",
    homeUrl: "https://www.tod.tv/ar",
  },
};

/** Opens URL in system browser / Custom Tabs — never embeds DRM content. */
export function openOfficialLink(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}
