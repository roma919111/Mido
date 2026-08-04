import type { PlatformId } from "../types";
import { toOfficialWebUrl } from "./platforms";

/** True when URL points at a specific title/show (not browse home). */
export function isDirectDeepLink(platform: PlatformId, url: string): boolean {
  const u = toOfficialWebUrl(url);
  switch (platform) {
    case "netflix":
      return /netflix\.com\/(title|watch)\/\d+/i.test(u);
    case "shahid":
      return /shahid\.mbc\.net\/\w+\/(series|movie|show|program)\//i.test(u);
    case "tod":
      return /tod\.tv\/.+\/.+/i.test(u) && !/\/ar\/?$/i.test(u);
    default:
      return false;
  }
}

/**
 * Normalize to the deepest official link available (title/watch, not browse).
 * Netflix /watch/ opens closer to playback when the user is signed in.
 */
export function normalizeDeepLink(platform: PlatformId, url: string): string {
  const web = toOfficialWebUrl(url);

  if (platform === "netflix") {
    const titleId = web.match(/netflix\.com\/(?:title|watch)\/(\d+)/i)?.[1];
    if (titleId) {
      return `https://www.netflix.com/watch/${titleId}`;
    }
  }

  if (platform === "shahid") {
    // Already a deep path — keep; strip tracking params
    try {
      const parsed = new URL(web);
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return web;
    }
  }

  return web;
}

export function deepLinkHint(platform: PlatformId, url: string): string {
  if (isDirectDeepLink(platform, url)) {
    return "رابط مباشر للعنوان — صفحة التشغيل بسرعة";
  }
  return "يفتح قسم المنصة — اختر العنوان هناك";
}
