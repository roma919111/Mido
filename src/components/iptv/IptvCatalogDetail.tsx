"use client";

import { useEffect, useMemo, useState } from "react";
import type { IptvChannel, IptvMovieDetails, IptvSeriesDetails, IptvSeriesEpisode } from "@/lib/iptv-client";
import { fetchIptvMovieDetails, fetchIptvSeriesDetails } from "@/lib/iptv-client";
import { isFavoriteChannel, toggleFavoriteChannel } from "@/lib/iptv-favorites";

type IptvCatalogDetailProps = {
  item: IptvChannel;
  sessionId: string;
  onBack: () => void;
  onPlay: (playable: IptvChannel) => void;
};

function movieIdFromItem(item: IptvChannel): number | null {
  if (item.id.startsWith("movie-")) {
    const n = Number(item.id.slice(6));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

function seriesIdFromItem(item: IptvChannel): number | null {
  if (item.seriesId && item.seriesId > 0) return item.seriesId;
  if (item.id.startsWith("series-")) {
    const n = Number(item.id.slice(7));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

function MetaRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <p className="mstv-detail__meta">
      <span>{label}</span>
      {value}
    </p>
  );
}

export function IptvCatalogDetail({ item, sessionId, onBack, onPlay }: IptvCatalogDetailProps) {
  const isSeries = item.kind === "series" || item.id.startsWith("series-");
  const [movie, setMovie] = useState<IptvMovieDetails | null>(null);
  const [series, setSeries] = useState<IptvSeriesDetails | null>(null);
  const [seasonKey, setSeasonKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorite, setFavorite] = useState(() => isFavoriteChannel(item.id));
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMovie(null);
    setSeries(null);

    void (async () => {
      try {
        if (isSeries) {
          const id = seriesIdFromItem(item);
          if (!id) throw new Error("مسلسل غير صالح");
          const details = await fetchIptvSeriesDetails(sessionId, id);
          if (cancelled) return;
          setSeries(details);
          setSeasonKey(details.seasons[0]?.season ?? "");
        } else {
          const id = movieIdFromItem(item);
          if (!id) throw new Error("فيلم غير صالح");
          const details = await fetchIptvMovieDetails(sessionId, id);
          if (cancelled) return;
          setMovie(details);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "تعذّر تحميل التفاصيل");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [item, isSeries, sessionId]);

  const title = movie?.title || series?.title || item.name;
  const cover = movie?.cover || series?.cover || item.logo;
  const plot = movie?.plot || series?.plot;
  const episodes = useMemo(
    () => series?.seasons.find((s) => s.season === seasonKey)?.episodes ?? [],
    [series, seasonKey],
  );

  function handleFavorite() {
    setFavorite(toggleFavoriteChannel(item));
  }

  function playMovie() {
    const url = movie?.playUrl || item.url;
    if (!url) {
      setError("لا يوجد رابط تشغيل");
      return;
    }
    onPlay({
      ...item,
      kind: "movie",
      name: title,
      logo: cover,
      url,
    });
  }

  function playEpisode(ep: IptvSeriesEpisode) {
    setPlaying(true);
    onPlay({
      ...item,
      id: `series-ep-${ep.id}`,
      kind: "movie",
      name: `${title} · ${ep.title}`,
      logo: ep.cover || cover,
      url: ep.playUrl,
    });
    window.setTimeout(() => setPlaying(false), 400);
  }

  function playFirstEpisode() {
    const first = series?.seasons[0]?.episodes[0];
    if (!first) {
      setError("لا توجد حلقات");
      return;
    }
    if (seasonKey !== series?.seasons[0]?.season) {
      setSeasonKey(series?.seasons[0]?.season ?? seasonKey);
    }
    playEpisode(first);
  }

  return (
    <div className="mstv-detail">
      <div className="mstv-detail__hero" style={cover ? { backgroundImage: `url("${cover}")` } : undefined}>
        <div className="mstv-detail__hero-scrim" />
        <header className="mstv-detail__bar">
          <button type="button" className="mstv-detail__back" onClick={onBack}>
            ← رجوع
          </button>
        </header>
      </div>

      <div className="mstv-detail__body">
        <div className="mstv-detail__poster">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" />
          ) : (
            <div className="mstv-grid-card__poster-fallback">TV</div>
          )}
        </div>

        <div className="mstv-detail__info">
          <p className="mstv-detail__kind">{isSeries ? "مسلسل" : "فيلم"}</p>
          <h1 className="mstv-detail__title">{title}</h1>
          <div className="mstv-detail__chips">
            {(movie?.year || series?.year) ? <span>{movie?.year || series?.year}</span> : null}
            {(movie?.genre || series?.genre) ? <span>{movie?.genre || series?.genre}</span> : null}
            {(movie?.rating || series?.rating) ? <span>★ {movie?.rating || series?.rating}</span> : null}
            {movie?.duration ? <span>{movie.duration}</span> : null}
          </div>
          {plot ? <p className="mstv-detail__plot">{plot}</p> : null}
          <MetaRow label="إخراج" value={movie?.director || series?.director} />
          <MetaRow label="البطولة" value={movie?.cast || series?.cast} />

          <div className="mstv-detail__actions">
            <button
              type="button"
              className="mstv-detail__play"
              disabled={playing || (isSeries ? loading : loading && !item.url && !movie?.playUrl)}
              onClick={() => (isSeries ? playFirstEpisode() : playMovie())}
            >
              ▶ تشغيل
            </button>
            <button type="button" className={`mstv-detail__fav ${favorite ? "is-on" : ""}`} onClick={handleFavorite}>
              {favorite ? "♥ في المفضلة" : "♡ إضافة للمفضلة"}
            </button>
          </div>

          {loading ? <p className="mstv-empty">جاري تحديث التفاصيل…</p> : null}
          {error ? <p className="iptv-error">{error}</p> : null}

          {isSeries && series?.seasons.length ? (
            <section className="mstv-detail__episodes">
              <div className="mstv-detail__seasons">
                {series.seasons.map((season) => (
                  <button
                    key={season.season}
                    type="button"
                    className={`mstv-detail__season ${season.season === seasonKey ? "is-active" : ""}`}
                    onClick={() => setSeasonKey(season.season)}
                  >
                    {season.name}
                  </button>
                ))}
              </div>
              <div className="mstv-detail__ep-list">
                {episodes.map((ep) => (
                  <button key={ep.id} type="button" className="mstv-detail__ep" onClick={() => playEpisode(ep)}>
                    <span className="mstv-detail__ep-num">{ep.episodeNum || "·"}</span>
                    <span className="mstv-detail__ep-body">
                      <strong>{ep.title}</strong>
                      {ep.duration ? <em>{ep.duration}</em> : null}
                      {ep.plot ? <small>{ep.plot}</small> : null}
                    </span>
                    <span className="mstv-detail__ep-play">▶</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
