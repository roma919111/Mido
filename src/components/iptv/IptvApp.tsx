"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  bindIptvSession,
  clearCredentials,
  fetchIptvChannels,
  getSavedCredentials,
  loginIptv,
  pingIptvSession,
  subscribeIptvSession,
  type IptvCategory,
  type IptvChannel,
  type IptvCredentials,
  type IptvKind,
  type IptvLoginResult,
} from "@/lib/iptv-client";
import { getFavoriteChannels, getRecentChannels, pushRecentChannel } from "@/lib/iptv-favorites";
import { pickDefaultLiveCategoryId } from "@/lib/iptv-live-default";
import { IptvBrandMark } from "./IptvBrandMark";
import { IptvCatalogDetail } from "./IptvCatalogDetail";
import { IptvChannelGrid } from "./IptvChannelGrid";
import { IptvHomePage } from "./IptvHomePage";
import { IptvLiveGuide } from "./IptvLiveGuide";
import { IptvMaxSidebar } from "./IptvMaxSidebar";
import { IptvPlayer, preloadIptvPlayerEngine } from "./IptvPlayer";

type MainNav = "home" | "live" | "movies" | "series" | "favorites";
type CatalogNav = "movies" | "series";
type ChannelView = string | "favorite" | "recent";

const PAGE_SIZE = 48;
const LIVE_PAGE_SIZE = 100;


const CATALOG_KIND: Record<CatalogNav, IptvKind> = {
  movies: "movie",
  series: "series",
};

type IptvAppProps = {
  authMode?: "credentials" | "device";
  bootstrap?: IptvLoginResult | null;
  deviceLabel?: string;
  onDeviceExit?: () => void;
};

export function IptvApp({ authMode = "credentials", bootstrap = null, deviceLabel, onDeviceExit }: IptvAppProps) {
  const [host, setHost] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [liveCategories, setLiveCategories] = useState<IptvCategory[]>([]);
  const [movieCategories, setMovieCategories] = useState<IptvCategory[]>([]);
  const [seriesCategories, setSeriesCategories] = useState<IptvCategory[]>([]);
  const [channels, setChannels] = useState<IptvChannel[]>([]);
  const [active, setActive] = useState<IptvChannel | null>(null);
  const [detailItem, setDetailItem] = useState<IptvChannel | null>(null);
  const [nav, setNav] = useState<MainNav>("home");
  const [channelView, setChannelView] = useState<ChannelView>("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loggedIn, setLoggedIn] = useState(Boolean(bootstrap));
  const [bootstrapping, setBootstrapping] = useState(Boolean(bootstrap));
  const [label, setLabel] = useState("");
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const loadGen = useRef(0);
  const bootstrappedRef = useRef(false);
  const displayLabel = deviceLabel ?? label;

  useEffect(() => {
    void preloadIptvPlayerEngine();
  }, []);

  useEffect(() => subscribeIptvSession(setSessionId), []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!sessionId) return;
    const beat = () => {
      void pingIptvSession(sessionId);
    };
    beat();
    const timer = window.setInterval(beat, 2 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sessionId]);

  const catalogCategories = useMemo(() => {
    if (nav === "movies") return movieCategories;
    if (nav === "series") return seriesCategories;
    return [];
  }, [nav, movieCategories, seriesCategories]);

  const loadGrid = useCallback(
    async (sid: string, kind: IptvKind, view: ChannelView, q: string, offset: number, append: boolean) => {
      const gen = ++loadGen.current;
      if (offset === 0) setLoadingGrid(true);
      else setLoadingMore(true);
      const pageSize = kind === "live" ? LIVE_PAGE_SIZE : PAGE_SIZE;

      try {
        if (view === "favorite") {
          const favs = getFavoriteChannels();
          const filtered =
            q.trim().length >= 2
              ? favs.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()))
              : favs;
          if (gen !== loadGen.current) return;
          setChannels(filtered.slice(0, offset + pageSize));
          setTotal(filtered.length);
          setHasMore(offset + pageSize < filtered.length);
          setError(null);
          return;
        }

        if (view === "recent") {
          const recent = getRecentChannels();
          const filtered =
            q.trim().length >= 2
              ? recent.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()))
              : recent;
          if (gen !== loadGen.current) return;
          setChannels(filtered.slice(0, offset + pageSize));
          setTotal(filtered.length);
          setHasMore(offset + pageSize < filtered.length);
          setError(null);
          return;
        }

        const page = await fetchIptvChannels({
          sessionId: sid,
          kind,
          categoryId: view || undefined,
          search: q,
          offset,
          limit: pageSize,
        });

        if (gen !== loadGen.current) return;

        if (page.loading) {
          window.setTimeout(() => {
            void loadGrid(sid, kind, view, q, offset, append);
          }, 450);
          return;
        }

        if (kind === "movie" && page.categories?.length) {
          setMovieCategories(page.categories);
          if (!view && page.categories[0]) {
            setChannelView(page.categories[0].id);
          }
        }
        if (kind === "series" && page.categories?.length) {
          setSeriesCategories(page.categories);
          if (!view && page.categories[0]) {
            setChannelView(page.categories[0].id);
          }
        }
        if (kind === "live" && page.categories?.length) {
          setLiveCategories(page.categories);
          if (!view) {
            const preferred = pickDefaultLiveCategoryId(page.categories);
            if (preferred) setChannelView(preferred);
          }
        }

        setChannels((prev) => (append ? [...prev, ...page.channels] : page.channels));
        setTotal(page.total);
        setHasMore(page.hasMore);
        setError(null);
      } catch (e) {
        if (gen !== loadGen.current) return;
        setError(e instanceof Error ? e.message : "فشل تحميل المحتوى");
        if (!append) setChannels([]);
      } finally {
        if (gen === loadGen.current) {
          setLoadingGrid(false);
          setLoadingMore(false);
        }
      }
    },
    [],
  );

  const applyLogin = useCallback(
    async (result: IptvLoginResult) => {
      bindIptvSession(
        result.sessionId,
        authMode === "device"
          ? undefined
          : async () => {
              const saved = getSavedCredentials();
              if (!saved) return null;
              const next = await loginIptv(saved);
              return next.sessionId;
            },
      );
      setSessionId(result.sessionId);
      setLiveCategories(result.liveCategories);
      setMovieCategories(result.movieCategories);
      setSeriesCategories(result.seriesCategories);
      setLabel(result.label ?? result.username);
      setLoggedIn(true);
      setNav("home");
      setChannelView("");
      setBootstrapping(false);
    },
    [authMode],
  );

  const login = useCallback(
    async (creds: IptvCredentials) => {
      setLoading(true);
      setError(null);
      try {
        const result = await loginIptv(creds);
        await applyLogin(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "فشل تسجيل الدخول");
        setLoggedIn(false);
      } finally {
        setLoading(false);
      }
    },
    [applyLogin],
  );

  useEffect(() => {
    if (!bootstrap || bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    setBootstrapping(true);
    void applyLogin(bootstrap).catch((e) => {
      setBootstrapping(false);
      setLoggedIn(false);
      setError(e instanceof Error ? e.message : "فشل تحميل القنوات");
      if (authMode === "device") onDeviceExit?.();
    });
  }, [authMode, bootstrap, applyLogin, onDeviceExit]);

  useEffect(() => {
    if (bootstrap || authMode === "device") return;
    const saved = getSavedCredentials();
    if (saved) {
      setHost(saved.host);
      setUsername(saved.username);
      setPassword(saved.password);
      void login(saved);
    }
  }, [authMode, bootstrap, login]);

  useEffect(() => {
    if (!sessionId || (nav !== "movies" && nav !== "series" && nav !== "live")) return;
    const kind: IptvKind = nav === "live" ? "live" : CATALOG_KIND[nav];
    const view =
      nav === "live" && !channelView ? pickDefaultLiveCategoryId(liveCategories) : channelView;
    void loadGrid(sessionId, kind, view, debouncedSearch, 0, false);
  }, [sessionId, nav, channelView, debouncedSearch, loadGrid, liveCategories]);

  function isCatalogItem(ch: IptvChannel) {
    return (
      ch.kind === "movie" ||
      ch.kind === "series" ||
      ch.id.startsWith("movie-") ||
      ch.id.startsWith("series-")
    );
  }

  function handlePlay(ch: IptvChannel) {
    if (isCatalogItem(ch)) {
      setError(null);
      setDetailItem(ch);
      return;
    }

    if (!ch.url) {
      setError("لا يوجد رابط تشغيل");
      return;
    }

    pushRecentChannel(ch);
    setDetailItem(null);
    setActive(ch);
  }

  function handleDetailPlay(playable: IptvChannel) {
    pushRecentChannel(playable);
    setActive(playable);
  }

  function handleLogout() {
    loadGen.current++;
    if (authMode !== "device") {
      clearCredentials();
    }
    setSessionId(null);
    setChannels([]);
    setActive(null);
    setDetailItem(null);
    setPassword("");
    setMovieCategories([]);
    setSeriesCategories([]);
    if (authMode === "device") {
      onDeviceExit?.();
      return;
    }
    setLoggedIn(false);
  }

  const loadMore = useCallback(() => {
    if (!sessionId || !hasMore || loadingMore || nav === "favorites" || nav === "home") return;
    const kind: IptvKind = nav === "live" ? "live" : CATALOG_KIND[nav];
    void loadGrid(
      sessionId,
      kind,
      nav === "live" && !channelView ? pickDefaultLiveCategoryId(liveCategories) : channelView,
      debouncedSearch,
      channels.length,
      true,
    );
  }, [sessionId, hasMore, loadingMore, nav, channelView, debouncedSearch, channels.length, loadGrid, liveCategories]);

  function switchNav(next: MainNav) {
    setNav(next);
    setSearch("");
    setDebouncedSearch("");
    setChannels([]);
    setError(null);
    setDetailItem(null);

    if (next === "favorites") {
      setChannelView("favorite");
      return;
    }

    if (next === "home" || next === "movies" || next === "series") {
      setChannelView("");
      return;
    }

    if (next === "live") {
      setChannelView(pickDefaultLiveCategoryId(liveCategories));
    }
  }

  if (active) {
    const livePlaylist = active.kind !== "movie" && active.kind !== "series" ? channels : [];
    const liveIndex = livePlaylist.findIndex((ch) => ch.id === active.id);
    return (
      <IptvPlayer
        url={active.url}
        name={active.name}
        kind={active.kind}
        onBack={() => setActive(null)}
        onPrev={
          liveIndex > 0
            ? () => handlePlay(livePlaylist[liveIndex - 1])
            : undefined
        }
        onNext={
          liveIndex >= 0 && liveIndex < livePlaylist.length - 1
            ? () => handlePlay(livePlaylist[liveIndex + 1])
            : undefined
        }
      />
    );
  }

  if (detailItem && sessionId) {
    return (
      <IptvCatalogDetail
        item={detailItem}
        sessionId={sessionId}
        onBack={() => setDetailItem(null)}
        onPlay={handleDetailPlay}
      />
    );
  }

  if (!loggedIn || bootstrapping) {
    if (authMode === "device") {
      return (
        <div className="mstv-app mstv-app--login">
          <div className="mstv-app__stage">
            <p className="mstv-empty">جاري تحميل القنوات…</p>
            {error ? <p className="iptv-error">{error}</p> : null}
          </div>
        </div>
      );
    }

    return (
      <div className="mstv-app mstv-app--login">
        <div className="mstv-app__stage">
          <div className="mstv-app__dots mstv-app__dots--cyan" aria-hidden="true" />
          <div className="mstv-app__dots mstv-app__dots--magenta" aria-hidden="true" />
          <div className="iptv-login mstv-login-panel">
            <IptvBrandMark />
            <p className="iptv-login__sub">Host · Username · Password</p>
            <form
              className="iptv-login__form"
              onSubmit={(e) => {
                e.preventDefault();
                void login({ host, username, password });
              }}
            >
              <label className="iptv-field">
                <span>Host</span>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="http://server.com:8080"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  required
                />
              </label>
              <label className="iptv-field">
                <span>Username</span>
                <input type="text" dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)} required />
              </label>
              <label className="iptv-field">
                <span>Password</span>
                <input
                  type="password"
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              {error ? <p className="iptv-error">{error}</p> : null}
              <button type="submit" className="iptv-login__btn" disabled={loading}>
                {loading ? "جاري الاتصال…" : "تسجيل الدخول"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mstv-app">
      <IptvMaxSidebar active={nav} onChange={switchNav} />

      <div className="mstv-app__stage">
        <div className="mstv-app__dots mstv-app__dots--cyan" aria-hidden="true" />
        <div className="mstv-app__dots mstv-app__dots--magenta" aria-hidden="true" />

        <main className="mstv-app__main">
          {nav === "home" && sessionId ? (
            <IptvHomePage
              sessionId={sessionId}
              deviceLabel={displayLabel}
              onOpen={handlePlay}
              onLogout={handleLogout}
            />
          ) : null}

          {nav === "live" ? (
            <IptvLiveGuide
              categories={liveCategories}
              categoryId={channelView || pickDefaultLiveCategoryId(liveCategories)}
              channels={channels}
              total={total}
              search={search}
              loading={loadingGrid}
              loadingMore={loadingMore}
              hasMore={hasMore}
              error={error}
              deviceLabel={displayLabel}
              onSearch={setSearch}
              onSelectCategory={setChannelView}
              onPlay={handlePlay}
              onLoadMore={loadMore}
              onLogout={handleLogout}
            />
          ) : null}

          {nav === "favorites" ? (
            <div className="mstv-movies-main mstv-movies-main--solo">
              <header className="mstv-topbar">
                <h1 className="mstv-topbar__title">FAVORITES</h1>
                <button type="button" className="mstv-topbar__sort" onClick={handleLogout}>
                  خروج · {displayLabel}
                </button>
              </header>
              <IptvChannelGrid
                items={getFavoriteChannels()}
                onPlay={handlePlay}
                empty="لا توجد مفضّلة — اضغط على ❤️ من أي قناة أو فيلم"
              />
            </div>
          ) : null}

          {nav === "movies" || nav === "series" ? (
            <IptvLiveGuide
              variant={nav === "movies" ? "movie" : "series"}
              categories={catalogCategories}
              categoryId={channelView || catalogCategories[0]?.id || ""}
              channels={channels}
              total={total}
              search={search}
              loading={loadingGrid}
              loadingMore={loadingMore}
              hasMore={hasMore}
              error={error}
              deviceLabel={displayLabel}
              onSearch={setSearch}
              onSelectCategory={setChannelView}
              onPlay={handlePlay}
              onLoadMore={loadMore}
              onLogout={handleLogout}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}
