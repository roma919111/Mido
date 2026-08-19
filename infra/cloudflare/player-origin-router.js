/**
 * Same-hostname split: vyronix.app stays the public domain.
 * Player paths go to the Europe Railway origin; everything else stays on Mido (Singapore).
 *
 * Live MPEG-TS must be returned from fetch() as-is. Rebuilding Response with
 * hop-by-hop headers (Transfer-Encoding) makes Cloudflare emit 502 and the
 * player shows "تعذّر تشغيل البث".
 */

const PLAYER_EXACT = new Set([
  "/player",
  "/maxmediaplayer",
  "/vyronixmaxmediaplayer",
  "/max",
  "/maxvyronixmerdia",
  "/maxvyronixmedia",
  "/maxvronixmedia",
  "/iptv",
  "/admin/iptv",
  "/api/iptv",
]);

const DROP_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "keep-alive",
  "proxy-connection",
  "transfer-encoding",
  "te",
  "trailer",
  "upgrade",
  "cf-connecting-ip",
  "cf-ew-via",
  "cf-ipcountry",
  "cf-ray",
  "cf-visitor",
  "cdn-loop",
]);

function pathnameOf(value) {
  try {
    if (!value) return "";
    if (value.startsWith("http://") || value.startsWith("https://")) {
      return new URL(value).pathname;
    }
    return value.startsWith("/") ? value.split("?")[0] : `/${value}`.split("?")[0];
  } catch {
    return "";
  }
}

function isPlayerPath(pathname) {
  const path = pathname.split("?")[0] || "/";
  if (PLAYER_EXACT.has(path)) return true;
  for (const prefix of PLAYER_EXACT) {
    if (path.startsWith(`${prefix}/`)) return true;
  }
  return path.startsWith("/promo/max-media");
}

function isPlayerAssetPath(pathname) {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/models/") ||
    pathname.startsWith("/promo/") ||
    pathname.startsWith("/icons/")
  );
}

function isStreamProxyPath(pathname) {
  return (
    pathname === "/api/iptv/proxy" ||
    pathname.startsWith("/api/iptv/proxy/") ||
    pathname === "/stream/live.m3u8" ||
    pathname === "/stream/seg.ts" ||
    pathname === "/stream/video.mp4" ||
    pathname.startsWith("/stream/")
  );
}

function playerReferrer(request) {
  const referer = pathnameOf(request.headers.get("Referer") || "");
  if (isPlayerPath(referer)) return true;
  const nextUrl = pathnameOf(request.headers.get("Next-Url") || "");
  return isPlayerPath(nextUrl);
}

function pickOrigin(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  // Video bytes used to work on the studio origin. Keep that hop so live
  // MPEG-TS is not depending on a new Europe IP allowlist.
  if (isStreamProxyPath(path)) return env.STUDIO_ORIGIN;
  if (isPlayerPath(path)) return env.PLAYER_ORIGIN;
  if (isPlayerAssetPath(path) && playerReferrer(request)) return env.PLAYER_ORIGIN;
  return env.STUDIO_ORIGIN;
}

function buildHeaders(request, publicHost, pathname) {
  const headers = new Headers();
  for (const [key, value] of request.headers) {
    if (DROP_REQUEST_HEADERS.has(key.toLowerCase())) continue;
    headers.append(key, value);
  }
  headers.set("X-Forwarded-Host", publicHost);
  headers.set("X-Forwarded-Proto", "https");
  if (isStreamProxyPath(pathname)) {
    headers.set("Accept-Encoding", "identity");
  }
  return headers;
}

export default {
  async fetch(request, env) {
    const studio = String(env.STUDIO_ORIGIN || "").replace(/\/$/, "");
    const player = String(env.PLAYER_ORIGIN || "").replace(/\/$/, "");
    if (!studio || !player) {
      return new Response("Player origin router is missing STUDIO_ORIGIN or PLAYER_ORIGIN", {
        status: 500,
      });
    }

    const publicUrl = new URL(request.url);

    // Infinite live MPEG-TS must stay on the zone origin (Singapore).
    // Movies/HLS are finite responses — send them to Europe so the file
    // does not travel Singapore twice.
    if (publicUrl.pathname === "/api/iptv/proxy") {
      return fetch(request);
    }

    if (isStreamProxyPath(publicUrl.pathname)) {
      const target = new URL(publicUrl.pathname + publicUrl.search, player);
      return fetch(target, {
        method: request.method,
        headers: buildHeaders(request, publicUrl.host, publicUrl.pathname),
        redirect: "manual",
      });
    }

    const origin = pickOrigin(request, { STUDIO_ORIGIN: studio, PLAYER_ORIGIN: player });
    const target = new URL(publicUrl.pathname + publicUrl.search, origin);
    const init = {
      method: request.method,
      headers: buildHeaders(request, publicUrl.host, publicUrl.pathname),
      redirect: "manual",
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body;
    }

    return fetch(target, init);
  },
};
