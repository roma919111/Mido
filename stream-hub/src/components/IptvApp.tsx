import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IptvChannel } from "../lib/iptv-client";
import {
  buildRows,
  filterByNav,
  type IptvNav,
} from "../lib/iptv-categories";
import { getFavoriteIds } from "../lib/iptv-favorites";
import {
  clearSavedCode,
  getSavedCode,
  getSavedLabel,
  isDevMode,
  loadPlaylist,
  saveCode,
  getSavedExpiry,
} from "../lib/iptv-client";
import { clearCodeFromUrl, getCodeFromUrl } from "../lib/customer-link";
import { normalizeDigits } from "../lib/normalize-digits";
import { useTvRemote } from "../hooks/useTvRemote";
import { IptvMediaRow } from "./IptvMediaRow";
import { IptvOttPanel } from "./IptvOttPanel";
import { IptvPlayer } from "./IptvPlayer";
import { IptvSidebar } from "./IptvSidebar";

export function IptvApp() {
  const [code, setCode] = useState(() => getSavedCode() ?? "");
  const [label, setLabel] = useState<string | null>(() => getSavedLabel());
  const [expiresAt, setExpiresAt] = useState<string | null>(() => getSavedExpiry());
  const [channels, setChannels] = useState<IptvChannel[]>([]);
  const [active, setActive] = useState<IptvChannel | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [autoSetup, setAutoSetup] = useState(false);
  const [nav, setNav] = useState<IptvNav>("live");
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => getFavoriteIds());
  const mainRef = useRef<HTMLElement>(null);

  const activate = useCallback(async (activationCode: string, silent = false) => {
    const trimmed = normalizeDigits(activationCode, 6);
    if (trimmed.length < 4) {
      if (!silent) setError("أدخل كود التفعيل (4–6 أرقام)");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const playlist = await loadPlaylist(trimmed);
      saveCode(trimmed, playlist.label, playlist.expiresAt);
      setCode(trimmed);
      setLabel(playlist.label);
      setExpiresAt(playlist.expiresAt);
      setChannels(playlist.channels);
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل التفعيل");
      setReady(false);
      setAutoSetup(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const urlCode = getCodeFromUrl();
    if (urlCode) {
      setAutoSetup(true);
      setCode(urlCode);
      clearCodeFromUrl();
      void activate(urlCode, true);
      return;
    }
    const saved = getSavedCode();
    if (saved) void activate(saved, true);
  }, [activate]);

  const filteredChannels = useMemo(() => {
    if (nav === "apps") return [];
    const q = filter.trim().toLowerCase();
    const base = filterByNav(channels, nav, favoriteIds);
    if (!q) return base;
    return base.filter((c) => c.name.toLowerCase().includes(q));
  }, [channels, nav, favoriteIds, filter]);

  const rows = useMemo(() => {
    if (nav === "apps") return [];
    if (filter.trim()) {
      return [{ id: "search", title: `نتائج البحث (${filteredChannels.length})`, channels: filteredChannels }];
    }
    return buildRows(filteredChannels, nav);
  }, [filteredChannels, nav, filter]);

  useTvRemote(mainRef);

  function logout() {
    clearSavedCode();
    setReady(false);
    setChannels([]);
    setCode("");
    setLabel(null);
    setExpiresAt(null);
    setActive(null);
  }

  function refreshFavorites() {
    setFavoriteIds(getFavoriteIds());
  }

  if (active) {
    return <IptvPlayer url={active.url} name={active.name} onBack={() => setActive(null)} />;
  }

  if (!ready) {
    if (autoSetup || loading) {
      return (
        <div className="iptv-login">
          <div className="iptv-login__card">
            <div className="iptv-login__logo">MAX</div>
            <h1>جاري تجهيز MAX SHOW TV…</h1>
            <p className="iptv-login__lead">لحظات — القنوات والإعدادات تُحمّل تلقائياً</p>
            {error ? <p className="iptv-login__error">{error}</p> : null}
          </div>
        </div>
      );
    }

    return (
      <div className="iptv-login">
        <div className="iptv-login__card">
          <div className="iptv-login__logo">MAX</div>
          <h1>MAX SHOW TV</h1>
          <p className="iptv-login__lead">أدخل كود الاشتراك من المزود</p>
          <input
            className="iptv-login__input"
            type="tel"
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(normalizeDigits(e.target.value, 6))}
            onKeyDown={(e) => e.key === "Enter" && void activate(code)}
          />
          {error ? <p className="iptv-login__error">{error}</p> : null}
          {isDevMode() ? (
            <p className="iptv-login__demo">
              للتجربة: شغّل <code>npm run dev</code> في المجلد الرئيسي ثم استخدم الكود{" "}
              <strong>123456</strong>
            </p>
          ) : null}
          <button
            type="button"
            className="iptv-login__btn"
            disabled={loading}
            onClick={() => void activate(code)}
          >
            {loading ? "جاري التحميل…" : "تفعيل"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-show">
      <IptvSidebar active={nav} onChange={setNav} onLogout={logout} label={label} expiresAt={expiresAt} />

      <div className="max-show__main">
        <div className="max-show__pattern" aria-hidden="true" />

        <header className="max-show__header">
          {nav !== "apps" ? (
            <input
              className="max-show__search"
              placeholder="بحث…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          ) : (
            <span className="max-show__header-title">البرامج الرسمية</span>
          )}
          <span className="max-show__version">v{__APP_VERSION__}</span>
        </header>

        <main ref={mainRef} tabIndex={-1} className="max-show__content">
          {nav === "apps" ? (
            <IptvOttPanel />
          ) : rows.length ? (
            rows.map((row) => (
              <IptvMediaRow
                key={row.id}
                row={row}
                onPlay={setActive}
                onFavoriteChange={refreshFavorites}
              />
            ))
          ) : (
            <p className="max-show__empty">
              {nav === "favorites"
                ? "اضغط ♡ على أي بوستر لإضافته للمفضلة"
                : "لا يوجد محتوى في هذا القسم — تحقق من قائمة M3U من المزود"}
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
