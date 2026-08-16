"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearCredentials,
  fetchIptvChannels,
  fetchIptvRows,
  getSavedCredentials,
  loginIptv,
  type IptvCategory,
  type IptvChannel,
  type IptvCredentials,
  type IptvRow,
} from "@/lib/iptv-client";
import { getFavoriteChannels, getRecentChannels, pushRecentChannel } from "@/lib/iptv-favorites";
import { IptvCategorySidebar } from "./IptvCategorySidebar";
import { IptvChannelGrid } from "./IptvChannelGrid";
import { IptvChannelRow } from "./IptvChannelRow";
import { IptvMaxSidebar } from "./IptvMaxSidebar";
import { IptvPlayer } from "./IptvPlayer";

type MainNav = "live" | "channels" | "favorites";
type ChannelView = string | "favorite" | "recent";

const PAGE_SIZE = 48;

export function IptvApp() {
  const [host, setHost] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [categories, setCategories] = useState<IptvCategory[]>([]);
  const [rows, setRows] = useState<IptvRow[]>([]);
  const [channels, setChannels] = useState<IptvChannel[]>([]);
  const [active, setActive] = useState<IptvChannel | null>(null);
  const [nav, setNav] = useState<MainNav>("live");
  const [channelView, setChannelView] = useState<ChannelView>("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [label, setLabel] = useState("");
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const loadGen = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const loadGrid = useCallback(
    async (sid: string, view: ChannelView, q: string, offset: number, append: boolean) => {
      const gen = ++loadGen.current;
      if (offset === 0) setLoadingGrid(true);
      else setLoadingMore(true);

      try {
        if (view === "favorite") {
          const favs = getFavoriteChannels();
          const filtered = q.trim().length >= 2
            ? favs.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()))
            : favs;
          if (gen !== loadGen.current) return;
          setChannels(filtered.slice(0, offset + PAGE_SIZE));
          setTotal(filtered.length);
          setHasMore(offset + PAGE_SIZE < filtered.length);
          setError(null);
          return;
        }

        if (view === "recent") {
          const recent = getRecentChannels();
          const filtered = q.trim().length >= 2
            ? recent.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()))
            : recent;
          if (gen !== loadGen.current) return;
          setChannels(filtered.slice(0, offset + PAGE_SIZE));
          setTotal(filtered.length);
          setHasMore(offset + PAGE_SIZE < filtered.length);
          setError(null);
          return;
        }

        const page = await fetchIptvChannels({
          sessionId: sid,
          categoryId: view || "all",
          search: q,
          offset,
          limit: PAGE_SIZE,
        });
        if (gen !== loadGen.current) return;
        setChannels((prev) => (append ? [...prev, ...page.channels] : page.channels));
        setTotal(page.total);
        setHasMore(page.hasMore);
        setError(null);
      } catch (e) {
        if (gen !== loadGen.current) return;
        setError(e instanceof Error ? e.message : "فشل تحميل القنوات");
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

  const login = useCallback(async (creds: IptvCredentials) => {
    setLoading(true);
    setError(null);
    try {
      const result = await loginIptv(creds);
      setSessionId(result.sessionId);
      setCategories(result.categories);
      setLabel(result.username);
      setLoggedIn(true);
      setNav("live");
      setChannelView(result.categories[0]?.id ?? "");

      const liveRows = await fetchIptvRows(result.sessionId);
      setRows(liveRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل تسجيل الدخول");
      setLoggedIn(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = getSavedCredentials();
    if (saved) {
      setHost(saved.host);
      setUsername(saved.username);
      setPassword(saved.password);
      void login(saved);
    }
  }, [login]);

  useEffect(() => {
    if (!sessionId || nav !== "channels") return;
    void loadGrid(sessionId, channelView, debouncedSearch, 0, false);
  }, [sessionId, nav, channelView, debouncedSearch, loadGrid]);

  const gridTitle = useMemo(() => {
    if (channelView === "favorite") return "FAVORITE";
    if (channelView === "recent") return "RECENTLY VIEWED";
    const cat = categories.find((c) => c.id === channelView);
    return cat?.name ?? "CHANNELS";
  }, [channelView, categories]);

  function handlePlay(ch: IptvChannel) {
    pushRecentChannel(ch);
    setActive(ch);
  }

  function handleLogout() {
    loadGen.current++;
    clearCredentials();
    setLoggedIn(false);
    setSessionId(null);
    setRows([]);
    setChannels([]);
    setActive(null);
    setPassword("");
  }

  function loadMore() {
    if (!sessionId || !hasMore || loadingMore) return;
    void loadGrid(sessionId, channelView, debouncedSearch, channels.length, true);
  }

  if (active) {
    return <IptvPlayer url={active.url} name={active.name} onBack={() => setActive(null)} />;
  }

  if (!loggedIn) {
    return (
      <div className="mstv-app mstv-app--login">
        <div className="mstv-app__stage">
          <div className="mstv-app__dots mstv-app__dots--cyan" aria-hidden="true" />
          <div className="mstv-app__dots mstv-app__dots--magenta" aria-hidden="true" />
          <div className="iptv-login mstv-login-panel">
            <div className="mstv-rail__logo mstv-login-panel__logo">
              <div className="mstv-rail__logo-circle" aria-hidden="true">
                <span>▶</span>
              </div>
              <div className="mstv-rail__brand">
                <strong>MAX</strong>
                <span>SHOW TV</span>
              </div>
            </div>
            <p className="iptv-login__sub">Host · Username · Password</p>
            <form className="iptv-login__form" onSubmit={(e) => { e.preventDefault(); void login({ host, username, password }); }}>
              <label className="iptv-field">
                <span>Host</span>
                <input type="text" dir="ltr" placeholder="http://server.com:8080" value={host} onChange={(e) => setHost(e.target.value)} required />
              </label>
              <label className="iptv-field">
                <span>Username</span>
                <input type="text" dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)} required />
              </label>
              <label className="iptv-field">
                <span>Password</span>
                <input type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} required />
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
      <IptvMaxSidebar
        active={nav}
        onChange={(id) => {
          setNav(id);
          if (id === "favorites") setChannelView("favorite");
          if (id === "channels" && channelView === "favorite") {
            setChannelView(categories[0]?.id ?? "");
          }
        }}
      />

      <div className="mstv-app__stage">
        <div className="mstv-app__dots mstv-app__dots--cyan" aria-hidden="true" />
        <div className="mstv-app__dots mstv-app__dots--magenta" aria-hidden="true" />

        <main className="mstv-app__main">
          {nav === "live" ? (
            <div className="mstv-browse">
              {rows.map((row) => (
                <IptvChannelRow key={row.id} title={row.title} items={row.channels} onPlay={handlePlay} />
              ))}
              {!rows.length && !loading ? <p className="mstv-empty">لا توجد قنوات</p> : null}
            </div>
          ) : null}

          {nav === "favorites" ? (
            <div className="mstv-movies-main mstv-movies-main--solo">
              <header className="mstv-topbar">
                <h1 className="mstv-topbar__title">FAVORITES</h1>
              </header>
              <IptvChannelGrid
                items={getFavoriteChannels()}
                onPlay={handlePlay}
                empty="لا توجد مفضّلة — اضغط على قناة من Channels"
              />
            </div>
          ) : null}

          {nav === "channels" ? (
            <div className="mstv-movies-layout">
              <IptvCategorySidebar
                categories={categories}
                active={channelView}
                search={search}
                onSearch={setSearch}
                onSelect={(id) => setChannelView(id)}
                onFavorite={() => setChannelView("favorite")}
                onRecent={() => setChannelView("recent")}
                favoriteActive={channelView === "favorite"}
                recentActive={channelView === "recent"}
              />

              <div className="mstv-movies-main">
                <header className="mstv-topbar">
                  <h1 className="mstv-topbar__title">{gridTitle}</h1>
                  <button type="button" className="mstv-topbar__sort" onClick={handleLogout}>
                    خروج · {label}
                  </button>
                </header>

                {error ? <p className="iptv-error">{error}</p> : null}
                {loadingGrid && !channels.length ? (
                  <p className="mstv-empty">جاري التحميل…</p>
                ) : (
                  <>
                    <IptvChannelGrid items={channels} onPlay={handlePlay} empty="لا توجد قنوات" />
                    {hasMore ? (
                      <button type="button" className="iptv-load-more" onClick={loadMore} disabled={loadingMore}>
                        {loadingMore ? "…" : "تحميل المزيد"}
                      </button>
                    ) : null}
                    <p className="iptv-count-bar">
                      {channels.length.toLocaleString("ar")} / {total.toLocaleString("ar")}
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
