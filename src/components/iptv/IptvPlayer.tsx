"use client";

import { useEffect, useRef, useState } from "react";
import type { IptvKind } from "@/lib/iptv-client";

type IptvPlayerProps = {
  url: string;
  name: string;
  kind?: IptvKind;
  onBack: () => void;
  onPrev?: () => void;
  onNext?: () => void;
};

type MpegtsPlayer = {
  attachMediaElement(element: HTMLMediaElement): void;
  load(): void;
  play(): void;
  destroy(): void;
  on(event: string, listener: () => void): void;
};

type MpegtsGlobal = {
  isSupported(): boolean;
  createPlayer(
    mediaDataSource: { type: string; isLive?: boolean; url: string },
    config?: Record<string, unknown>,
  ): MpegtsPlayer;
  Events: { ERROR: string; MEDIA_INFO?: string };
};

declare global {
  interface Window {
    mpegts?: MpegtsGlobal;
  }
}

const MPEGTS_SRC = "https://cdn.jsdelivr.net/npm/mpegts.js@1.8.2/dist/mpegts.min.js";
let mpegtsPromise: Promise<MpegtsGlobal | null> | null = null;

const VOD_COUNTDOWN_SEC = 8;
const VOD_PHRASE_MS = 3000;
const VOD_READY_LINES = [
  "جهزت البوب كورن؟",
  "ضبطت الكوفي",
  "قفلت النور!",
  "انسدحت!؟",
  "تغطيت بالبطانية!",
  "قصرت الصوت؟!",
];

function isVodKind(kind?: IptvKind): boolean {
  return kind === "movie" || kind === "series";
}

/** mpegts.js workers fail on cross-origin Railway URLs; live TS stays on this host. */
function sameOriginIptvProxy(url: string): string {
  if (typeof window === "undefined") return url;
  try {
    const parsed = new URL(url, window.location.origin);
    if (
      parsed.pathname === "/api/iptv/proxy" ||
      parsed.pathname.startsWith("/api/iptv/proxy/") ||
      parsed.pathname.startsWith("/api/iptv/hls/") ||
      parsed.pathname.startsWith("/stream/")
    ) {
      return `${window.location.origin}${parsed.pathname}${parsed.search}`;
    }
  } catch {
    /* keep original */
  }
  return url;
}

function decodeProxyTarget(url: string): string | null {
  try {
    const src = new URL(url, typeof window === "undefined" ? "https://vyronix.app" : window.location.origin).searchParams.get("src");
    if (!src) return null;
    const padded = src + "=".repeat((4 - (src.length % 4)) % 4);
    return atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    return null;
  }
}

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function rewriteProxiedSrc(url: string, rewrite: (target: string) => string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    const target = decodeProxyTarget(url);
    if (!target) return url;
    const next = rewrite(target);
    if (next === target) return url;
    parsed.searchParams.set("src", toBase64Url(next));
    return parsed.toString();
  } catch {
    return url;
  }
}

/** iPhone / iPad only. Mac Safari uses mpegts.js like Chrome — HLS transcode is too slow on laptop. */
function isIosWebKit(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iP(hone|ad|od)/i.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of urls) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function withHlsProxyPath(url: string, file: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    parsed.pathname = `/api/iptv/proxy/${file}`;
    return parsed.toString();
  } catch {
    return url;
  }
}

function toHlsUrl(url: string): string {
  const rewritten = rewriteProxiedSrc(url, (target) => {
    if (/\.m3u8(?:\?|$)/i.test(target)) return target;
    if (/\/(movie|series)\//i.test(target) || /\.(mkv|mp4|avi|mpg|mpeg|m4v)(?:\?|$)/i.test(target)) {
      return target;
    }
    if (/\.ts(?:\?|$)/i.test(target)) return target.replace(/\.ts(\?|$)/i, ".m3u8$1");
    if (/\/live\//i.test(target)) return target.replace(/(\/live\/[^\s?]+?)(\?|$)/i, "$1.m3u8$2");
    return target;
  });
  return withHlsProxyPath(rewritten, "live.m3u8");
}

function toBrowserMovieUrl(url: string): string {
  const rewritten = rewriteProxiedSrc(url, (target) =>
    target.replace(/\.(mkv|avi|mpg|mpeg|ts)(\?|$)/i, ".mp4$2"),
  );
  return withHlsProxyPath(rewritten, "video.mp4");
}

export function preloadIptvPlayerEngine(): Promise<MpegtsGlobal | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.mpegts?.isSupported()) return Promise.resolve(window.mpegts);
  if (mpegtsPromise) return mpegtsPromise;

  mpegtsPromise = new Promise((resolve) => {
    const existing = document.querySelector(`script[src="${MPEGTS_SRC}"]`);
    if (existing) {
      if (window.mpegts) {
        resolve(window.mpegts);
        return;
      }
      existing.addEventListener("load", () => resolve(window.mpegts ?? null), { once: true });
      existing.addEventListener("error", () => resolve(null), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = MPEGTS_SRC;
    script.async = true;
    script.onload = () => resolve(window.mpegts ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return mpegtsPromise;
}

export function IptvPlayer({ url, name, kind, onBack, onPrev, onNext }: IptvPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<MpegtsPlayer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsTap, setNeedsTap] = useState(false);
  const [resumeToken, setResumeToken] = useState(0);
  const [curtain, setCurtain] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(VOD_COUNTDOWN_SEC);
  const [readyLine, setReadyLine] = useState(VOD_READY_LINES[0]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      const video = videoRef.current;
      if (!video) return;
      if (video.error || video.ended || video.readyState < 2) {
        setResumeToken((n) => n + 1);
        return;
      }
      if (video.paused) void video.play().catch(() => undefined);
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    if (!isVodKind(kind) || !isIosWebKit()) {
      setCurtain(false);
      return;
    }
    setCurtain(true);
    setSecondsLeft(VOD_COUNTDOWN_SEC);
    setReadyLine(VOD_READY_LINES[0]);
    const started = Date.now();
    const tick = window.setInterval(() => {
      const elapsedMs = Date.now() - started;
      const elapsedSec = Math.floor(elapsedMs / 1000);
      const left = Math.max(0, VOD_COUNTDOWN_SEC - elapsedSec);
      setSecondsLeft(left);
      setReadyLine(VOD_READY_LINES[Math.floor(elapsedMs / VOD_PHRASE_MS) % VOD_READY_LINES.length]);
      if (left <= 0) {
        window.clearInterval(tick);
        setCurtain(false);
      }
    }, 200);
    return () => window.clearInterval(tick);
  }, [url, kind]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;
    const media = video;

    setError(null);
    setLoading(true);
    setNeedsTap(false);
    let cancelled = false;
    const ios = isIosWebKit();

    function hideLoading() {
      if (cancelled) return;
      setLoading(false);
      setCurtain(false);
    }

    function cleanup() {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      media.pause();
      media.removeAttribute("src");
      media.load();
    }

    const vod = isVodKind(kind);
    const playUrl = sameOriginIptvProxy(url);
    const failMessage = vod
      ? "تعذّر تشغيل الفيلم — اضغط ▶ على الشاشة أو جرّب فيلماً آخر"
      : "تعذّر تشغيل القناة — اضغط ▶ أو جرّب قناة أخرى";

    function playNativeQueue(sources: string[], failMessage: string) {
      const queue = uniqueUrls(sources);
      let index = 0;

      const tryAt = (i: number) => {
        if (cancelled) return;
        if (i >= queue.length) {
          setError(failMessage);
          setLoading(false);
          return;
        }

        cleanup();
        index = i;
        media.preload = "auto";
        media.playsInline = true;
        media.disableRemotePlayback = true;
        media.setAttribute("playsinline", "true");
        media.setAttribute("webkit-playsinline", "true");
        if (ios) media.muted = true;

        const onOk = () => {
          if (cancelled || index !== i) return;
          hideLoading();
          if (ios && media.muted && !cancelled) setNeedsTap(true);
          else setNeedsTap(false);
        };

        media.addEventListener("loadeddata", onOk, { once: true });
        media.addEventListener("canplay", onOk, { once: true });
        media.addEventListener("playing", onOk, { once: true });
        media.addEventListener(
          "error",
          () => {
            if (!cancelled && index === i) tryAt(i + 1);
          },
          { once: true },
        );
        media.src = queue[i];

        void media.play().then(onOk).catch((err: unknown) => {
          const errName = err && typeof err === "object" && "name" in err ? String((err as { name?: string }).name) : "";
          if (errName === "NotAllowedError") {
            hideLoading();
            if (!cancelled) setNeedsTap(true);
            return;
          }
          if (!cancelled && index === i) tryAt(i + 1);
        });
      };

      tryAt(0);
    }

    if (vod) {
      media.disableRemotePlayback = true;
      playNativeQueue(
        ios
          ? [toHlsUrl(playUrl), toBrowserMovieUrl(playUrl), playUrl]
          : [toBrowserMovieUrl(playUrl), playUrl],
        failMessage,
      );
      return () => {
        cancelled = true;
        cleanup();
      };
    }

    if (ios) {
      media.disableRemotePlayback = true;
      playNativeQueue([toHlsUrl(playUrl)], failMessage);
      return () => {
        cancelled = true;
        cleanup();
      };
    }

    void (async () => {
      const mpegts = await preloadIptvPlayerEngine();
      if (cancelled) return;

      if (!mpegts?.isSupported()) {
        playNativeQueue([toHlsUrl(playUrl)], failMessage);
        return;
      }

      cleanup();
      media.disableRemotePlayback = true;

      const player = mpegts.createPlayer(
        { type: "mpegts", isLive: true, url: playUrl },
        {
          enableWorker: false,
          lazyLoad: false,
          stashInitialSize: 512 * 1024,
          enableStashBuffer: true,
          liveBufferLatencyChasing: true,
          liveBufferLatencyMaxLatency: 10,
          liveBufferLatencyMinRemain: 1.5,
          autoCleanupSourceBuffer: true,
        },
      );
      playerRef.current = player;
      player.attachMediaElement(media);
      player.load();
      player.play();
      let fellBack = false;
      const fallbackNative = () => {
        if (cancelled || fellBack) return;
        fellBack = true;
        playNativeQueue([toHlsUrl(playUrl)], failMessage);
      };
      player.on(mpegts.Events.ERROR, fallbackNative);
      if (mpegts.Events.MEDIA_INFO) {
        player.on(mpegts.Events.MEDIA_INFO, hideLoading);
      }
      media.addEventListener("loadeddata", hideLoading, { once: true });
      media.addEventListener("playing", hideLoading, { once: true });
      media.addEventListener("canplay", hideLoading, { once: true });
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [url, kind, resumeToken]);

  useEffect(() => {
    if (isVodKind(kind)) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        onPrev?.();
      }
      if (event.key === "ArrowDown" || event.key === "PageDown") {
        event.preventDefault();
        onNext?.();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kind, onPrev, onNext]);

  return (
    <div className="iptv-player">
      <header className="iptv-player__bar">
        <button type="button" className="iptv-player__back" onClick={onBack}>
          ← رجوع
        </button>
        <span className="iptv-player__title">{name}</span>
        {kind !== "movie" && kind !== "series" && (onPrev || onNext) ? (
          <span className="iptv-player__zap">
            <button type="button" onClick={onPrev} disabled={!onPrev}>
              القناة السابقة
            </button>
            <button type="button" onClick={onNext} disabled={!onNext}>
              القناة التالية
            </button>
          </span>
        ) : null}
      </header>
      {curtain && !error ? (
        <div className="iptv-popcorn" aria-live="polite">
          <div className="iptv-popcorn__bucket" aria-hidden="true">
            <span className="iptv-popcorn__kernel iptv-popcorn__kernel--a">🍿</span>
            <span className="iptv-popcorn__kernel iptv-popcorn__kernel--b">🍿</span>
            <span className="iptv-popcorn__kernel iptv-popcorn__kernel--c">🍿</span>
            <span className="iptv-popcorn__bucket-art">🍿</span>
            <span className="iptv-popcorn__count">{secondsLeft}</span>
          </div>
          <p className="iptv-popcorn__line">{readyLine}</p>
          <p className="iptv-popcorn__hint">يبدأ العرض بعد {secondsLeft} ثانية</p>
        </div>
      ) : null}
      {loading && !error && !needsTap && !curtain ? (
        <p className="mstv-empty iptv-player__status">جاري تجهيز البث…</p>
      ) : null}
      {error ? <p className="iptv-error iptv-player__error">{error}</p> : null}
      {needsTap && !error && !curtain ? (
        <button
          type="button"
          className="iptv-player__tap"
          onClick={() => {
            const el = videoRef.current;
            if (!el) return;
            el.muted = false;
            void el.play().then(() => setNeedsTap(false)).catch(() => undefined);
          }}
        >
            اضغط للتشغيل / الصوت
        </button>
      ) : null}
      <video
        ref={videoRef}
        className="iptv-player__video"
        controls
        playsInline
        autoPlay
        preload="auto"
        disableRemotePlayback
      />
    </div>
  );
}
