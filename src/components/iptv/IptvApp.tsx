"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  clearCredentials,
  getSavedCredentials,
  loadPlaylist,
  type IptvChannel,
  type IptvCredentials,
} from "@/lib/iptv-client";
import { IptvPlayer } from "./IptvPlayer";

export function IptvApp() {
  const [host, setHost] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [channels, setChannels] = useState<IptvChannel[]>([]);
  const [active, setActive] = useState<IptvChannel | null>(null);
  const [filter, setFilter] = useState("");
  const [group, setGroup] = useState<string | "all">("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [label, setLabel] = useState("");

  const login = useCallback(async (creds: IptvCredentials) => {
    setLoading(true);
    setError(null);
    try {
      const playlist = await loadPlaylist(creds);
      setChannels(playlist.channels);
      setLabel(playlist.label || creds.username);
      setLoggedIn(true);
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

  const groups = useMemo(() => {
    const set = new Set<string>();
    for (const c of channels) {
      if (c.group) set.add(c.group);
    }
    return ["all", ...Array.from(set).sort()];
  }, [channels]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return channels.filter((c) => {
      if (group !== "all" && c.group !== group) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q);
    });
  }, [channels, filter, group]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void login({ host, username, password });
  }

  function handleLogout() {
    clearCredentials();
    setLoggedIn(false);
    setChannels([]);
    setActive(null);
    setPassword("");
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

          <p className="iptv-login__hint">
            مثال Host: <code dir="ltr">http://server.com:8080</code>
          </p>
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
            placeholder="بحث…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <button type="button" className="iptv-logout" onClick={handleLogout}>
            خروج
          </button>
        </div>
      </header>

      <div className="iptv-groups">
        {groups.map((g) => (
          <button
            key={g}
            type="button"
            className={`iptv-group-btn${group === g ? " iptv-group-btn--active" : ""}`}
            onClick={() => setGroup(g)}
          >
            {g === "all" ? "الكل" : g}
          </button>
        ))}
      </div>

      <div className="iptv-grid">
        {filtered.map((ch) => (
          <button
            key={ch.id}
            type="button"
            className="iptv-card"
            onClick={() => setActive(ch)}
          >
            {ch.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ch.logo} alt="" className="iptv-card__logo" loading="lazy" />
            ) : (
              <div className="iptv-card__logo iptv-card__logo--placeholder">TV</div>
            )}
            <span className="iptv-card__name">{ch.name}</span>
            {ch.group ? <span className="iptv-card__group">{ch.group}</span> : null}
          </button>
        ))}
      </div>

      {!filtered.length ? <p className="iptv-empty">لا توجد قنوات</p> : null}
    </div>
  );
}
