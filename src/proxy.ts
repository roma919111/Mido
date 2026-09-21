import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isPlayerPath,
  isPlayerPublicAsset,
  isPlayerSurface,
} from "@/lib/vyronix-surface";
import { parseTenantSlugFromHost } from "@/lib/tenant-host";

/**
 * Player-only origin (Europe): refuse AI/studio routes so this replica
 * cannot serve generate/create even if someone hits the Railway URL.
 * Studio origin (Singapore) is a no-op.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname === "/stream/live.m3u8" ||
    pathname === "/stream/seg.ts" ||
    pathname === "/stream/video.mp4" ||
    pathname === "/api/iptv/proxy/live.m3u8" ||
    pathname === "/api/iptv/proxy/seg.ts" ||
    pathname === "/api/iptv/proxy/video.mp4"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/api/iptv/proxy";
    return NextResponse.rewrite(url);
  }

  if (!isPlayerSurface()) {
    const tenantSlug = parseTenantSlugFromHost(request.headers.get("host"));
    if (tenantSlug) {
      const allow =
        pathname.startsWith("/api/tenant") ||
        pathname.startsWith("/api/health") ||
        pathname.startsWith("/_next/") ||
        pathname.startsWith("/tenant-portal/");
      if (allow) return NextResponse.next();
      if (pathname === "/" || pathname === "") {
        const url = request.nextUrl.clone();
        url.pathname = `/tenant-portal/${tenantSlug}`;
        return NextResponse.rewrite(url);
      }
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.next();
  }

  if (
    isPlayerPath(pathname) ||
    isPlayerPublicAsset(pathname) ||
    pathname.startsWith("/_next/") ||
    pathname === "/api/health"
  ) {
    return NextResponse.next();
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
