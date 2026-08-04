import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { CATALOG, ROWS } from "./data/catalog";
import { getSession, logout } from "./lib/auth";
import { enterAppShellMode, exitAppShellMode } from "./lib/app-shell";
import { getContinueWatching, getContinueEntry, getMyList } from "./lib/library";
import {
  cancelLaunch,
  finishPopcornOverlay,
  launchOnPlatform,
  openPlatformBrowserSync,
  openPlatformManually,
  prepareLaunch,
} from "./lib/playback";
import { enterPlaybackMode } from "./lib/fullscreen";
import { clearAllReturnFlags } from "./lib/app-navigation";
import { pushOverlayHistory, useReturnToHome } from "./hooks/useReturnToHome";
import { ReturnHomeButton } from "./components/ReturnHomeButton";
import { AccountPlatforms } from "./components/AccountPlatforms";
import { ContentRow } from "./components/ContentRow";
import { DetailSheet } from "./components/DetailSheet";
import { HeroBanner } from "./components/HeroBanner";
import { OverlayPortal } from "./components/OverlayPortal";
import { PopcornSplash } from "./components/PopcornSplash";
import { PosterCard } from "./components/PosterCard";
import { SearchBar } from "./components/SearchBar";
import { SmartSetup, shouldShowSmartSetup } from "./components/SmartSetup";
import { MaxLoginPage } from "./components/MaxLoginPage";
import { InstallAppBanner } from "./components/InstallAppBanner";
import type { CatalogItem, ContinueEntry, LaunchState, PlatformId } from "./types";
function mapContinueToItems(entries: ContinueEntry[]): CatalogItem[] {
  return entries
    .map((entry) => CATALOG.find((item) => item.id === entry.itemId))
    .filter((item): item is CatalogItem => Boolean(item));
}

function HomePage({ username, onLogout }: { username: string; onLogout: () => void }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [launching, setLaunching] = useState<LaunchState | null>(null);
  const [showPopcorn, setShowPopcorn] = useState(false);
  const [tab, setTab] = useState<"home" | "list" | "account">("home");
  const [continueItems, setContinueItems] = useState<CatalogItem[]>([]);
  const [listHint, setListHint] = useState<string | null>(null);
  const [manualOpenUrl, setManualOpenUrl] = useState<string | null>(null);

  const featured = CATALOG.find((i) => i.featured) ?? CATALOG[0]!;

  useEffect(() => {
    enterAppShellMode();
    return () => exitAppShellMode();
  }, []);

  useEffect(() => {
    setContinueItems(mapContinueToItems(getContinueWatching()));
  }, [launching, selected]);

  useEffect(() => {
    if (!showPopcorn) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      cancelLaunch();
      setLaunching(null);
      setShowPopcorn(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showPopcorn]);

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
    setShowPopcorn(false);
    setSelected(null);
    setSearch("");
    setTab("home");
    setListHint(null);
  }

  function handleBackStep(): boolean {
    if (showPopcorn || launching) {
      cancelLaunch();
      setLaunching(null);
      setShowPopcorn(false);
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
    isPlaybackActive: () => showPopcorn || launching !== null,
  });

  function openDetails(item: CatalogItem) {
    setSelected(item);
    pushOverlayHistory();
  }

  function handleReturnHomeClick() {
    clearAllReturnFlags();
    setManualOpenUrl(null);
    resetToHomeInterface();
  }

  function startPlayback(
    item: CatalogItem,
    platform: CatalogItem["platforms"][0]["platform"],
    url: string,
  ) {
    launchOnPlatform(
      item,
      platform,
      url,
      (state) => {
        prepareLaunch(state);
        const result = openPlatformBrowserSync(state);
        enterPlaybackMode();
        flushSync(() => {
          setLaunching(state);
          setShowPopcorn(true);
        });
        if (result.needsManualOpen) setManualOpenUrl(result.destination);
      },
      () => {
        setContinueItems(mapContinueToItems(getContinueWatching()));
        setListHint(`«${item.title}» في قائمتي — ارجع لتبويب MAX`);
      },
    );
  }

  function handlePopcornDone() {
    if (!launching) return;
    void finishPopcornOverlay(launching).then(() => {
      setShowPopcorn(false);
      setLaunching(null);
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
          <span className="gtv-header__max">MAX</span> MEDIA PLAYER
          <span className="gtv-header__version">v{__APP_VERSION__}</span>
        </div>
        <SearchBar value={search} onChange={setSearch} />
        <button type="button" className="gtv-header__logout" onClick={onLogout}>
          خروج
        </button>
      </header>

      <InstallAppBanner />

      {manualOpenUrl ? (
        <div className="manual-open-banner">
          <p>Safari حظر فتح Netflix تلقائياً</p>
          <button
            type="button"
            className="manual-open-banner__btn"
            onClick={() => {
              if (openPlatformManually(manualOpenUrl)) setManualOpenUrl(null);
            }}
          >
            ▶ افتح Netflix
          </button>
        </div>
      ) : null}

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
      {showPopcorn && launching ? (
        <OverlayPortal>
          <PopcornSplash
            title={launching.title}
            platformName={launching.platformName}
            onDone={handlePopcornDone}
          />
        </OverlayPortal>
      ) : null}
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
      enterAppShellMode();
      setUsername(session.username);
      setAuthed(true);
    }
  }, []);

  if (!setupDone) {
    return <SmartSetup onDone={() => setSetupDone(true)} />;
  }

  if (!authed) {
    return (
      <MaxLoginPage
        onSuccess={() => {
          const session = getSession();
          setUsername(session?.username ?? "");
          setAuthed(true);
        }}
      />
    );
  }

  return <HomePage username={username} onLogout={() => { exitAppShellMode(); logout(); setAuthed(false); }} />;
}
