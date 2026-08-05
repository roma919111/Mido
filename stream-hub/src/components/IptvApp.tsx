import { useCallback, useEffect, useMemo, useState } from "react";
import type { IptvChannel } from "../lib/iptv-client";
import {
  clearSavedCode,
  getSavedCode,
  getSavedLabel,
  isDevMode,
  loadPlaylist,
  saveCode,
} from "../lib/iptv-client";
import { normalizeDigits } from "../lib/normalize-digits";
import { IptvPlayer } from "./IptvPlayer";

export function IptvApp() {
  const [code, setCode] = useState(() => getSavedCode() ?? "");
  const [label, setLabel] = useState<string | null>(() => getSavedLabel());
  const [channels, setChannels] = useState<IptvChannel[]>([]);
  const [active, setActive] = useState<IptvChannel | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const activate = useCallback(async (activationCode: string) => {
    const trimmed = normalizeDigits(activationCode, 6);
    if (trimmed.length < 4) {
      setError("أدخل كود التفعيل (4–6 أرقام)");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const playlist = await loadPlaylist(trimmed);
      saveCode(trimmed, playlist.label);
      setCode(trimmed);
      setLabel(playlist.label);
      setChannels(playlist.channels);
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل التفعيل");
      setReady(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = getSavedCode();
    if (saved) void activate(saved);
  }, [activate]);

  const groups = useMemo(() => {
    const map = new Map<string, IptvChannel[]>();
    for (const ch of channels) {
      const g = ch.group || "عام";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(ch);
    }
    return map;
  }, [channels]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter((c) => c.name.toLowerCase().includes(q));
  }, [channels, filter]);

  function logout() {
    clearSavedCode();
    setReady(false);
    setChannels([]);
    setCode("");
    setLabel(null);
    setActive(null);
  }

  if (active) {
    return <IptvPlayer url={active.url} name={active.name} onBack={() => setActive(null)} />;
  }

  if (!ready) {
    return (
      <div className="iptv-login">
        <div className="iptv-login__card">
          <div className="iptv-login__logo">MAX</div>
          <h1>MAX IPTV</h1>
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
    <div className="iptv-app">
      <header className="iptv-app__header">
        <div>
          <span className="iptv-app__brand">MAX IPTV</span>
          {label ? <span className="iptv-app__label">{label}</span> : null}
        </div>
        <button type="button" className="iptv-app__logout" onClick={logout}>
          خروج
        </button>
      </header>

      <div className="iptv-app__search-wrap">
        <input
          className="iptv-app__search"
          placeholder="بحث عن قناة…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <main className="iptv-app__main">
        {filter ? (
          <section>
            <h2 className="iptv-app__group-title">نتائج البحث ({filtered.length})</h2>
            <div className="iptv-channels">
              {filtered.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  className="iptv-channel"
                  onClick={() => setActive(ch)}
                >
                  {ch.logo ? <img src={ch.logo} alt="" className="iptv-channel__logo" /> : null}
                  <span>{ch.name}</span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          [...groups.entries()].map(([group, list]) => (
            <section key={group}>
              <h2 className="iptv-app__group-title">{group}</h2>
              <div className="iptv-channels">
                {list.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    className="iptv-channel"
                    onClick={() => setActive(ch)}
                  >
                    {ch.logo ? <img src={ch.logo} alt="" className="iptv-channel__logo" /> : null}
                    <span>{ch.name}</span>
                  </button>
                ))}
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  );
}
