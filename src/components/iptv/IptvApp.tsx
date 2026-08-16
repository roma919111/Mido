"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearCredentials,
  fetchIptvChannels,
  getSavedCredentials,
  loginIptv,
  type IptvCategory,
  type IptvChannel,
  type IptvCredentials,
} from "@/lib/iptv-client";
import { IptvPlayer } from "./IptvPlayer";

const PAGE_SIZE = 60;

export function IptvApp() {
  const [host, setHost] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [categories, setCategories] = useState<IptvCategory[]>([]);
  const [channels, setChannels] = useState<IptvChannel[]>([]);
  const [active, setActive] = useState<IptvChannel | null>(null);
  const [filter, setFilter] = useState("");
  const [debouncedFilter, setDebouncedFilter] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [label, setLabel] = useState("");
  const [total, setTotal] = useState(0);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const loadGen = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedFilter(filter), 350);
    return () => window.clearTimeout(t);
  }, [filter]);

  const loadPage = useCallback(
    async (sid: string, cat: string, search: string, offset: number, append: boolean) => {
      const gen = ++loadGen.current;
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);

      try {
        const page = await fetchIptvChannels({
          sessionId: sid,
          categoryId: cat,
          search,
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
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [],
  );

  const login = useCallback(
    async (creds: IptvCredentials) => {
      setLoading(true);
      setError(null);
      setInfo(null);
      setChannels([]);
      try {
        const result = await loginIptv(creds);
        setSessionId(result.sessionId);
        setCategories(result.categories);
        setLabel(result.label || creds.username);
        setLoggedIn(true);
        setCategory("all");
        setCatalogTotal(result.total);
        setInfo(`${result.total.toLocaleString("ar")} قناة — اختر قسماً أو ابحث بالاسم`);
        await loadPage(result.sessionId, "all", "", 0, false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "فشل تسجيل الدخول");
        setLoggedIn(false);
        setLoading(false);
      }
    },
    [loadPage],
  );

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
    if (!sessionId || !loggedIn) return;
    void loadPage(sessionId, category, debouncedFilter, 0, false);
  }, [sessionId, category, debouncedFilter, loggedIn, loadPage]);

  const categoryOptions = useMemo(() => {
    return [{ id: "all", name: "الكل", count: catalogTotal }, ...categories];
  }, [categories, catalogTotal]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void login({ host, username, password });
  }

  function handleLogout() {
    loadGen.current++;
    clearCredentials();
    setLoggedIn(false);
    setSessionId(null);
    setCategories([]);
    setChannels([]);
    setActive(null);
    setPassword("");
  }

  function loadMore() {
    if (!sessionId || !hasMore || loadingMore) return;
    void loadPage(sessionId, category, debouncedFilter, channels.length, true);
  }

  if (active) {
    return <IptvPlayer url={active.url} name={active.name} onBack={() => setActive(null)} />;
  }

  if (!loggedIn) {
    return (
      <div className="iptv-shell">
        <div className="iptv-login">
          <h1 className="iptv-login__title">MAX IPTV</h1>
          <p className="iptv-login__sub">أدخل بيانات اشتراك Xtream (Host · Username · Password)</p>

          <form className="iptv-login__form" onSubmit={handleSubmit}>
            <label className="iptv-field">
              <span>Host</span>
              <input
                type="text"
                dir="ltr"
                placeholder="http://example.com:8080"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                autoComplete="url"
                required
              />
            </label>

            <label className="iptv-field">
              <span>Username</span>
              <input
                type="text"
                dir="ltr"
                placeholder="user123"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </label>

            <label className="iptv-field">
              <span>Password</span>
              <input
                type="password"
                dir="ltr"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
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
    );
  }

  return (
    <div className="iptv-shell">
      <header className="iptv-header">
        <div>
          <h1 className="iptv-header__title">MAX IPTV</h1>
          <p className="iptv-header__user">{label}</p>
        </div>
        <div className="iptv-header__actions">
          <input
            type="search"
            className="iptv-search"
            placeholder="بحث (حرفين+)…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <button type="button" className="iptv-logout" onClick={handleLogout}>
            خروج
          </button>
        </div>
      </header>

      {info ? <p className="iptv-info">{info}</p> : null}
      {error ? <p className="iptv-error">{error}</p> : null}

      <div className="iptv-toolbar">
        <label className="iptv-select-wrap">
          <span>القسم</span>
          <select
            className="iptv-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.count.toLocaleString("ar")})
              </option>
            ))}
          </select>
        </label>
        <span className="iptv-count">
          {loading ? "جاري التحميل…" : `${channels.length.toLocaleString("ar")} / ${total.toLocaleString("ar")}`}
        </span>
      </div>

      {loading && !channels.length ? (
        <p className="iptv-empty">جاري تحميل القنوات…</p>
      ) : (
        <>
          <div className="iptv-grid">
            {channels.map((ch) => (
              <button key={ch.id} type="button" className="iptv-card" onClick={() => setActive(ch)}>
                {ch.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ch.logo} alt="" className="iptv-card__logo" loading="lazy" decoding="async" />
                ) : (
                  <div className="iptv-card__logo iptv-card__logo--placeholder">TV</div>
                )}
                <span className="iptv-card__name">{ch.name}</span>
              </button>
            ))}
          </div>

          {hasMore ? (
            <button type="button" className="iptv-load-more" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "جاري التحميل…" : "تحميل المزيد"}
            </button>
          ) : null}

          {!channels.length && !loading ? <p className="iptv-empty">لا توجد نتائج</p> : null}
        </>
      )}
    </div>
  );
}
