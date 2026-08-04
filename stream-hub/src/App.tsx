import { useEffect, useMemo, useState } from "react";
import { CATALOG, ROWS } from "./data/catalog";
import { getSession, login, logout } from "./lib/auth";
import { getContinueWatching, getContinueEntry, getMyList } from "./lib/library";
import { cancelLaunch, launchOnPlatform } from "./lib/playback";
import { consumePendingReturnHome } from "./lib/app-navigation";
import { pushOverlayHistory, useReturnToHome } from "./hooks/useReturnToHome";
import { ReturnHomeButton } from "./components/ReturnHomeButton";
import { AccountPlatforms } from "./components/AccountPlatforms";
import { ContentRow } from "./components/ContentRow";
import { DetailSheet } from "./components/DetailSheet";
import { HeroBanner } from "./components/HeroBanner";
import { LaunchOverlay } from "./components/LaunchOverlay";
import { PosterCard } from "./components/PosterCard";
import { SearchBar } from "./components/SearchBar";
import { SmartSetup, shouldShowSmartSetup } from "./components/SmartSetup";
import type { CatalogItem, ContinueEntry, LaunchState, PlatformId } from "./types";

function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!login(username, password)) {
      setError("اسم المستخدم أو كلمة المرور غير صحيحة");
      return;
    }
    setError(null);
    onSuccess();
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-card__brand">Stream Hub</div>
        <h1>تجربة مشاهدة سهلة</h1>
        <p className="subtitle">واجهة موحّدة بأسلوب Google TV — اكتشف، ابحث، وشغّل.</p>
        {error ? <p className="error-text">{error}</p> : null}
        <div className="field">
          <label htmlFor="username">اسم المستخدم</label>
          <input
            id="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">كلمة المرور</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="primary-btn">
          دخول
        </button>
      </form>
    </div>
  );
}

function mapContinueToItems(entries: ContinueEntry[]): CatalogItem[] {
  return entries
    .map((entry) => CATALOG.find((item) => item.id === entry.itemId))
    .filter((item): item is CatalogItem => Boolean(item));
}

function HomePage({ username, onLogout }: { username: string; onLogout: () => void }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [launching, setLaunching] = useState<LaunchState | null>(null);
  const [tab, setTab] = useState<"home" | "list" | "account">("home");
  const [continueItems, setContinueItems] = useState<CatalogItem[]>([]);
  const [listHint, setListHint] = useState<string | null>(null);

  const featured = CATALOG.find((i) => i.featured) ?? CATALOG[0]!;

  useEffect(() => {
    setContinueItems(mapContinueToItems(getContinueWatching()));
  }, [launching, selected]);

  const myListItems = useMemo(
    () => CATALOG.filter((item) => getMyList().includes(item.id)),
    [selected, tab],
  );

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return CATALOG.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.titleEn?.toLowerCase().includes(q) ||
        item.synopsis.toLowerCase().includes(q),
    );
  }, [search]);

  function resetToHomeInterface() {
    cancelLaunch();
    setLaunching(null);
    setSelected(null);
    setSearch("");
    setTab("home");
    setListHint(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBackStep(): boolean {
    if (launching) {
      cancelLaunch();
      setLaunching(null);
      return true;
    }
    if (selected) {
      setSelected(null);
      return true;
    }
    if (search.trim()) {
      setSearch("");
      return true;
    }
    if (tab !== "home") {
      setTab("home");
      return true;
    }
    return false;
  }

  useReturnToHome({
    onReturnHome: resetToHomeInterface,
    onBackStep: handleBackStep,
  });

  function openDetails(item: CatalogItem) {
    setSelected(item);
    pushOverlayHistory();
  }

  function handleReturnHomeClick() {
    consumePendingReturnHome();
    resetToHomeInterface();
  }

  function startPlayback(item: CatalogItem, platform: CatalogItem["platforms"][0]["platform"], url: string) {
    pushOverlayHistory();
    launchOnPlatform(item, platform, url, setLaunching, () => {
      setContinueItems(mapContinueToItems(getContinueWatching()));
      setListHint(`«${item.title}» في قائمتي — اضغط 🏠 للرجوع`);
    });
  }

  function resolvePlayback(item: CatalogItem): { platform: PlatformId; url: string } | null {
    const saved = getContinueEntry(item.id);
    if (saved) return { platform: saved.platform, url: saved.url };
    const link = item.platforms[0];
    if (!link) return null;
    return { platform: link.platform, url: link.url };
  }

  function quickPlay(item: CatalogItem) {
    const target = resolvePlayback(item);
    if (!target) return;
    startPlayback(item, target.platform, target.url);
  }

  function playFeatured(item: CatalogItem) {
    const link = item.platforms[0];
    if (!link) return;
    startPlayback(item, link.platform, link.url);
  }

  return (
    <div className="gtv-shell">
      <header className="gtv-header">
        <div className="gtv-header__brand">
          Stream Hub
          <span className="gtv-header__version">v{__APP_VERSION__}</span>
        </div>
        <SearchBar value={search} onChange={setSearch} />
        <button type="button" className="gtv-header__logout" onClick={onLogout}>
          خروج
        </button>
      </header>

      {listHint ? (
        <div className="list-hint">
          <p>{listHint}</p>
          <button type="button" onClick={() => { setTab("list"); setListHint(null); }}>
            فتح قائمتي
          </button>
          <button type="button" className="list-hint__dismiss" onClick={() => setListHint(null)} aria-label="إغلاق">
            ✕
          </button>
        </div>
      ) : null}

      {search.trim() ? (
        <main className="gtv-main">
          <h2 className="gtv-section-title">نتائج البحث</h2>
          <div className="content-row__track content-row__track--wrap">
            {searchResults.map((item) => (
              <PosterCard key={item.id} item={item} onSelect={openDetails} />
            ))}
            {!searchResults.length ? (
              <p className="gtv-empty">لا توجد نتائج لـ «{search}»</p>
            ) : null}
          </div>
        </main>
      ) : tab === "home" ? (
        <main className="gtv-main">
          <HeroBanner
            item={featured}
            onPlay={playFeatured}
            onDetails={openDetails}
          />

          {continueItems.length ? (
            <ContentRow
              title="متابعة المشاهدة"
              items={continueItems}
              onSelect={openDetails}
              onPlay={quickPlay}
            />
          ) : null}

          {ROWS.map((row) => (
            <ContentRow
              key={row.id}
              title={row.title}
              items={row.filter(CATALOG)}
              onSelect={openDetails}
              wideFirst={row.id === "featured"}
            />
          ))}
        </main>
      ) : tab === "list" ? (
        <main className="gtv-main gtv-main--padded">
          <h2 className="gtv-section-title">قائمتي</h2>
          {myListItems.length ? (
            <div className="content-row__track content-row__track--wrap">
              {myListItems.map((item) => (
                <PosterCard key={item.id} item={item} onSelect={openDetails} onPlay={quickPlay} />
              ))}
            </div>
          ) : (
            <p className="gtv-empty">بعد «تشغيل» أي عنوان يُضاف تلقائياً هنا — ثم ▶ للمتابعة.</p>
          )}
        </main>
      ) : tab === "account" ? (
        <main className="gtv-main gtv-main--padded">
          <AccountPlatforms streamHubUsername={username} />
        </main>
      ) : null}

      <nav className="gtv-nav">
        <button
          type="button"
          className={tab === "home" && !search ? "active" : ""}
          onClick={() => {
            setTab("home");
            setSearch("");
          }}
        >
          🏠 الرئيسية
        </button>
        <button
          type="button"
          className={tab === "list" ? "active" : ""}
          onClick={() => {
            setTab("list");
            setSearch("");
          }}
        >
          📋 قائمتي
        </button>
        <button
          type="button"
          className={tab === "account" ? "active" : ""}
          onClick={() => {
            setTab("account");
            setSearch("");
          }}
        >
          👤 حسابي
        </button>
      </nav>

      <DetailSheet
        item={selected}
        onClose={() => setSelected(null)}
        onPlay={(item, platform, url) => {
          setSelected(null);
          startPlayback(item, platform, url);
        }}
      />
      <LaunchOverlay
        state={launching}
        onCancel={() => {
          cancelLaunch();
          setLaunching(null);
        }}
        onDismiss={() => setLaunching(null)}
      />
      <ReturnHomeButton onClick={handleReturnHomeClick} />
    </div>
  );
}

export function App() {
  const [authed, setAuthed] = useState(false);
  const [username, setUsername] = useState("");
  const [setupDone, setSetupDone] = useState(() => !shouldShowSmartSetup());

  useEffect(() => {
    const session = getSession();
    if (session) {
      setUsername(session.username);
      setAuthed(true);
    }
  }, []);

  if (!setupDone) {
    return <SmartSetup onDone={() => setSetupDone(true)} />;
  }

  if (!authed) {
    return (
      <LoginPage
        onSuccess={() => {
          const session = getSession();
          setUsername(session?.username ?? "");
          setAuthed(true);
        }}
      />
    );
  }

  return <HomePage username={username} onLogout={() => { logout(); setAuthed(false); }} />;
}
