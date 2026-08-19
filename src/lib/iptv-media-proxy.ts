import { NextResponse } from "next/server";
import { ensureHlsJob, ffmpegAvailable, isVodMediaUrl, readHlsPlaylist, readHlsSegment, readHlsTextFile, streamVodMpegts } from "@/lib/iptv-hls-ffmpeg";
import { assertSafeIptvUrl } from "@/lib/iptv-ssrf";
import { getRequestPublicOrigin } from "@/lib/request-origin";

const SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

function corsHeaders(extra?: HeadersInit): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Content-Type",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
    ...extra,
  };
}

export function iptvProxyOptions(): Response {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

function proxyFileName(target: string): string {
  if (/\.m3u8(?:\?|$)/i.test(target)) return "live.m3u8";
  if (/\.mp4(?:\?|$)/i.test(target) || target.includes("/movie/") || target.includes("/series/")) return "video.mp4";
  if (/\.ts(?:\?|$)/i.test(target) || target.includes("/live/")) return "seg.ts";
  return "video.mp4";
}

function proxyUrl(request: Request, target: string): string {
  const origin = getRequestPublicOrigin(request);
  const b64 = Buffer.from(target, "utf8").toString("base64url");
  return `${origin}/api/iptv/proxy/${proxyFileName(target)}?src=${b64}`;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function hlsUrlCandidates(target: string): string[] {
  const urls = [target];
  try {
    const parsed = new URL(target);
    const origin = parsed.origin;
    const live = parsed.pathname.match(/^(.*)\/live\/([^/]+)\/([^/]+)\/([^/.]+)(?:\.[^/]+)?$/i);
    if (live) {
      const prefix = live[1] ?? "";
      const user = live[2];
      const pass = live[3];
      const id = live[4];
      urls.push(`${origin}${prefix}/live/${user}/${pass}/${id}.m3u8`);
      urls.push(`${origin}${prefix}/live/${user}/${pass}/${id}/index.m3u8`);
      urls.push(`${origin}${prefix}/hls/${user}/${pass}/${id}.m3u8`);
      urls.push(`${origin}${prefix}/hls/${user}/${pass}/${id}/index.m3u8`);
    }
    const movie = parsed.pathname.match(/^(.*)\/(movie|series)\/([^/]+)\/([^/]+)\/([^/.]+)(?:\.[^/]+)?$/i);
    if (movie) {
      const prefix = movie[1] ?? "";
      const kind = movie[2];
      const user = movie[3];
      const pass = movie[4];
      const id = movie[5];
      urls.push(`${origin}${prefix}/${kind}/${user}/${pass}/${id}.m3u8`);
      urls.push(`${origin}${prefix}/${kind}/${user}/${pass}/${id}.mp4`);
    }
    if (/\.ts(?:\?|$)/i.test(parsed.pathname)) {
      urls.push(target.replace(/\.ts(\?|$)/i, ".m3u8$1"));
    }
  } catch {
    /* keep original */
  }
  return uniqueStrings(urls);
}

function looksLikeHls(text: string): boolean {
  const head = text.slice(0, 1600);
  if (!/#EXTM3U/i.test(head)) return false;
  if (/#EXT-X-STREAM-INF/i.test(text)) return true;
  if (!/#EXT-X-TARGETDURATION/i.test(text)) return false;
  const inf = text.match(/#EXTINF:(-?[\d.]+)/gi) ?? [];
  if (inf.length === 0) return false;
  if (inf.length === 1 && /EXTINF:\s*-1/i.test(inf[0])) return false;
  return true;
}

async function fetchUpstream(target: string, range: string | null, hls: boolean): Promise<Response> {
  return fetch(target, {
    headers: {
      "User-Agent": hls ? SAFARI_UA : "VLC/3.0.20",
      Accept: hls ? "application/vnd.apple.mpegurl, application/x-mpegURL, */*" : "*/*",
      Connection: "keep-alive",
      ...(range ? { Range: range } : {}),
    },
    redirect: "follow",
    cache: "no-store",
    // Playlist probes can fail fast. Movie/live byte streams must not be killed mid-play.
    ...(hls ? { signal: AbortSignal.timeout(8000) } : {}),
  });
}

function isManifest(contentType: string, target: string): boolean {
  return contentType.includes("mpegurl") || contentType.includes("x-mpegURL") || target.includes(".m3u8");
}

function isLiveStream(target: string): boolean {
  return target.includes("/live/") || /\.ts(?:\?|$)/i.test(target);
}

function resolveTarget(srcB64: string | null): string | null {
  if (!srcB64) return null;
  try {
    const decoded = Buffer.from(srcB64, "base64url").toString("utf8");
    assertSafeIptvUrl(decoded);
    return decoded;
  } catch {
    return null;
  }
}

function guessMediaType(target: string, fallback: string): string {
  if (/\.m3u8(?:\?|$)/i.test(target) || fallback.includes("mpegurl")) return "application/vnd.apple.mpegurl";
  if (/\.mkv(?:\?|$)/i.test(target)) return "video/x-matroska";
  if (/\.mp4(?:\?|$)/i.test(target)) return "video/mp4";
  if (/\.ts(?:\?|$)/i.test(target) || target.includes("/live/")) {
    return fallback.includes("mpegurl") ? fallback : "video/mp2t";
  }
  if (fallback && fallback !== "application/octet-stream") return fallback;
  if (target.includes("/movie/") || target.includes("/series/")) return "video/mp4";
  return fallback || "application/octet-stream";
}

function passthroughHeaders(upstream: Response, target: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Content-Type",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
    "Content-Type": guessMediaType(target, upstream.headers.get("content-type") ?? "application/octet-stream"),
    "Content-Disposition": "inline",
  };

  if (isLiveStream(target)) {
    headers["Cache-Control"] = "no-store";
  } else {
    headers["Cache-Control"] = "private, max-age=120";
  }

  const length = upstream.headers.get("content-length");
  if (length) headers["Content-Length"] = length;

  const range = upstream.headers.get("content-range");
  if (range) headers["Content-Range"] = range;

  const acceptRanges = upstream.headers.get("accept-ranges");
  if (acceptRanges) {
    headers["Accept-Ranges"] = acceptRanges;
  } else if (!isLiveStream(target)) {
    headers["Accept-Ranges"] = "bytes";
  }

  return headers;
}

function sanitizeHlsPlaylist(text: string): string {
  const durations = [...text.matchAll(/#EXTINF:(-?[\d.]+)/gi)].map((match) => Number(match[1]));
  const maxDuration = durations.reduce((max, value) => (Number.isFinite(value) ? Math.max(max, value) : max), 0);
  const target = Math.max(2, Math.ceil(maxDuration));
  let out = text.replace(/\r\n/g, "\n");
  out = out
    .split("\n")
    .filter((line) => !/^#EXT-X-DISCONTINUITY\s*$/i.test(line.trim()))
    .join("\n");
  if (/#EXT-X-TARGETDURATION:\d+/i.test(out)) {
    out = out.replace(/#EXT-X-TARGETDURATION:\d+/i, `#EXT-X-TARGETDURATION:${target}`);
  } else {
    out = out.replace(/#EXTM3U/i, `#EXTM3U\n#EXT-X-TARGETDURATION:${target}`);
  }
  if (!/#EXT-X-INDEPENDENT-SEGMENTS/i.test(out)) {
    out = out.replace(/#EXTM3U/i, "#EXTM3U\n#EXT-X-INDEPENDENT-SEGMENTS");
  }
  if (/#EXT-X-VERSION:\d+/i.test(out)) {
    out = out.replace(/#EXT-X-VERSION:\d+/i, "#EXT-X-VERSION:6");
  } else {
    out = out.replace(/#EXTM3U/i, "#EXTM3U\n#EXT-X-VERSION:6");
  }
  return out;
}

function rewriteGeneratedPlaylist(text: string, request: Request, jobId: string): string {
  const origin = getRequestPublicOrigin(request);
  const isMaster = /#EXT-X-STREAM-INF/i.test(text);
  const body = isMaster ? text.replace(/\r\n/g, "\n") : sanitizeHlsPlaylist(text);
  return body
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return line;
      const name = trimmed.split("/").pop() ?? trimmed;
      if (/^(lo|hi)\.m3u8$/i.test(name)) {
        return `${origin}/api/iptv/proxy/live.m3u8?job=${jobId}&file=${encodeURIComponent(name)}`;
      }
      if (!/^(seg|lo|hi)\d+\.ts$/i.test(name)) return line;
      return `${origin}/api/iptv/proxy/seg.ts?job=${jobId}&file=${encodeURIComponent(name)}`;
    })
    .join("\n");
}

function rewritePlaylist(text: string, target: string, request: Request): string {
  const base = new URL(target);
  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/gi, (_match, uri: string) => {
          try {
            return `URI="${proxyUrl(request, new URL(uri, base).toString())}"`;
          } catch {
            return _match;
          }
        });
      }
      try {
        return proxyUrl(request, new URL(trimmed, base).toString());
      } catch {
        return line;
      }
    })
    .join("\n");
}

/** Proxy HLS/VOD/live for browser playback. HLS URLs keep .m3u8/.ts so Safari on iPhone accepts them. */
export async function handleIptvMediaProxy(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("job")?.trim() ?? "";
  const segment = url.searchParams.get("file")?.trim() ?? "";
  if (jobId && /\.m3u8$/i.test(segment)) {
    const text = await readHlsTextFile(jobId, segment);
    if (!text) {
      return NextResponse.json({ error: "Playlist expired" }, { status: 404, headers: corsHeaders() });
    }
    return new NextResponse(rewriteGeneratedPlaylist(text, request, jobId), {
      headers: corsHeaders({
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "no-store",
        "Content-Disposition": "inline; filename=live.m3u8",
      }),
    });
  }
  if (jobId && segment) {
    const bytes = await readHlsSegment(jobId, segment);
    if (!bytes) {
      return NextResponse.json({ error: "Segment expired" }, { status: 404, headers: corsHeaders() });
    }
    return new NextResponse(new Uint8Array(bytes), {
      headers: corsHeaders({
        "Content-Type": "video/mp2t",
        "Cache-Control": "no-store",
        "Content-Disposition": "inline; filename=seg.ts",
      }),
    });
  }

  const srcB64 = url.searchParams.get("src");
  const target = resolveTarget(srcB64);

  if (!target) {
    return NextResponse.json({ error: "Stream not found" }, { status: 404, headers: corsHeaders() });
  }

  const streamUrl = target;
  const range = request.headers.get("range");
  const wantsHls = /\.m3u8(?:\?|$)/i.test(streamUrl) || url.pathname.endsWith(".m3u8");
  const wantsFile = url.pathname.endsWith(".mp4") || url.pathname.endsWith("video.mp4");

  if (!wantsHls && !wantsFile && isVodMediaUrl(streamUrl) && ffmpegAvailable()) {
    try {
      return await streamVodMpegts(streamUrl, request.signal);
    } catch (e) {
      console.error("[hls-ffmpeg] vod pipe", e instanceof Error ? e.message : e);
    }
  }

  async function generatedHls(): Promise<Response> {
    const job = await ensureHlsJob(streamUrl);
    const playlist = rewriteGeneratedPlaylist(await readHlsPlaylist(job), request, job.id);
    return new NextResponse(playlist, {
      headers: corsHeaders({
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "no-store",
        "Content-Disposition": "inline; filename=live.m3u8",
      }),
    });
  }

  if (wantsHls && url.pathname.endsWith(".m3u8")) {
    try {
      return await generatedHls();
    } catch (e) {
      console.error("[hls-ffmpeg] primary", e instanceof Error ? e.message : e);
    }
  }

  const candidates = wantsHls ? hlsUrlCandidates(target).slice(0, 2) : [target];

  try {
    let lastStatus = 502;
    for (const candidate of candidates) {
      let upstream: Response;
      try {
        upstream = await fetchUpstream(candidate, range, wantsHls || /\.m3u8(?:\?|$)/i.test(candidate));
      } catch {
        continue;
      }

      if (!upstream.ok && upstream.status !== 206) {
        lastStatus = upstream.status;
        continue;
      }

      const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";

      if (isManifest(contentType, candidate) || wantsHls) {
        const text = await upstream.text();
        if (!looksLikeHls(text)) {
          lastStatus = 502;
          continue;
        }
        return new NextResponse(rewritePlaylist(text, candidate, request), {
          headers: corsHeaders({
            "Content-Type": "application/vnd.apple.mpegurl",
            "Cache-Control": "no-store",
            "Content-Disposition": "inline; filename=live.m3u8",
          }),
        });
      }

      const body = upstream.body;
      if (!body) {
        lastStatus = 502;
        continue;
      }

      return new NextResponse(body, {
        status: upstream.status,
        headers: passthroughHeaders(upstream, candidate),
      });
    }

    if (wantsHls) {
      try {
        return await generatedHls();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "HLS unavailable";
        return NextResponse.json({ error: msg }, { status: 502, headers: corsHeaders() });
      }
    }

    return NextResponse.json(
      { error: `Stream unavailable (${lastStatus})` },
      { status: 502, headers: corsHeaders() },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Proxy error";
    return NextResponse.json({ error: msg }, { status: 502, headers: corsHeaders() });
  }
}
