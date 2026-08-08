import { useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import type { CatalogItem, PlatformId } from "../types";
import { ottRowsForPlatform, platformUrl } from "../lib/ott-catalog";
import { enterKioskMode } from "../lib/kiosk-mode";
import { enterPlaybackMode } from "../lib/fullscreen";
import { isPlatformAppInstalled } from "../lib/platform-launch-native";
import { openPlatformLocked } from "../lib/platform-open";
import { PLATFORMS } from "../lib/platforms";
import { fetchTmdbDiscover, platformSearchUrl, type TmdbDiscoverItem } from "../lib/tmdb-discover";
import { IptvOttCatalogRow } from "./IptvOttCatalogRow";
import { TmdbDiscoverRow } from "./TmdbDiscoverRow";

type OttPlatformViewProps = {
  platform: PlatformId;
};

const TAGLINES: Record<PlatformId, string> = {
  netflix: "محتوى Netflix — بوسترات TMDB · deeplink للتشغيل",
  shahid: "محتوى شاهد — بوسترات TMDB · deeplink للتشغيل",
  tod: "محتوى TOD — بوسترات TMDB · deeplink للتشغيل",
};

export function OttPlatformView({ platform }: OttPlatformViewProps) {
  const meta = PLATFORMS[platform];
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [movies, setMovies] = useState<TmdbDiscoverItem[]>([]);
  const [series, setSeries] = useState<TmdbDiscoverItem[]>([]);

  const catalogRows = useMemo(() => ottRowsForPlatform(platform), [platform]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void isPlatformAppInstalled(platform).then(setInstalled);
  }, [platform, busy]);

  useEffect(() => {
    void fetchTmdbDiscover(platform, "movie").then(setMovies);
    void fetchTmdbDiscover(platform, "tv").then(setSeries);
  }, [platform]);

  function showMsg(text: string) {
    setMsg(text);
    window.setTimeout(() => setMsg(null), 5000);
  }

  async function openLocked(url?: string) {
    if (busy) return;
    setBusy(true);
    enterPlaybackMode();
    await enterKioskMode();
    showMsg(`جاري فتح ${meta.name}…`);
    const result = await openPlatformLocked(platform, url);
    if (result === "app") {
      showMsg(`${meta.name} — التطبيق · ارجع ← MAX`);
    } else if (result === "browser") {
      showMsg(`${meta.name} — deeplink · ارجع ← MAX`);
    } else {
      showMsg("تعذر الفتح");
    }
    setBusy(false);
  }

  function playCatalogItem(item: CatalogItem) {
    const url = platformUrl(item, platform);
    if (url) void openLocked(url);
  }

  function playDiscoverItem(item: TmdbDiscoverItem) {
    void openLocked(platformSearchUrl(platform, item.title));
  }

  return (
    <div className="max-show__ott">
      <header className="max-show__ott-platform-head max-show__ott-platform-head--solo">
        <div>
          <h1 style={{ color: meta.color }}>{meta.name}</h1>
          <p>{TAGLINES[platform]}</p>
        </div>
        <button
          type="button"
          className="max-show__ott-open-app"
          style={{ "--ott-color": meta.color } as React.CSSProperties}
          disabled={busy}
          onClick={() => void openLocked()}
        >
          {busy ? "…" : installed ? `▶ فتح ${meta.name}` : `📲 ${meta.name}`}
        </button>
      </header>

      {msg ? <p className="max-show__ott-msg">{msg}</p> : null}

      {movies.length ? (
        <TmdbDiscoverRow
          title="أفلام — TMDB"
          items={movies}
          platform={platform}
          onPlay={playDiscoverItem}
          busy={busy}
        />
      ) : null}

      {series.length ? (
        <TmdbDiscoverRow
          title="مسلسلات — TMDB"
          items={series}
          platform={platform}
          onPlay={playDiscoverItem}
          busy={busy}
        />
      ) : null}

      {catalogRows.map((row) => (
        <IptvOttCatalogRow
          key={row.id}
          title={row.title}
          items={row.items}
          platform={platform}
          onPlay={(item) => playCatalogItem(item)}
          busy={busy}
        />
      ))}

      {!movies.length && !series.length && !catalogRows.length ? (
        <p className="max-show__empty">
          أضف <code>TMDB_API_KEY</code> في السيرفر لعرض المحتوى من TMDB
        </p>
      ) : null}

      <p className="max-show__ott-note">
        التشغيل عبر deeplink في {meta.name} — تحتاج اشتراكك الرسمي. MAX يعرض المحتوى من TMDB
        ويفتح التطبيق الرسمي.
      </p>
    </div>
  );
}
