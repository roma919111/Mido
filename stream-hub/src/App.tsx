import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { CATALOG, ROWS } from "./data/catalog";
import { enterAppShellMode, exitAppShellMode } from "./lib/app-shell";
import { enterKioskMode, isKioskEnabled } from "./lib/kiosk-mode";
import { getContinueWatching, getContinueEntry, getMyList } from "./lib/library";
import {
  cancelLaunch,
  confirmBrowserPlayback,
  confirmInstallFromPlayStore,
  finishPopcornOverlay,
  launchOnPlatform,
  openPlatformBrowserSync,
  openPlatformManually,
  prepareLaunch,
  type InstallPromptPayload,
} from "./lib/playback";
import { enterPlaybackMode, exitPlaybackMode } from "./lib/fullscreen";
import { clearAllReturnFlags, wasPlatformOpened } from "./lib/app-navigation";
import { pushOverlayHistory, useReturnToHome } from "./hooks/useReturnToHome";
import { usePendingPlatformRetry } from "./hooks/usePendingPlatformRetry";
import { useTvRemote } from "./hooks/useTvRemote";
import { ReturnHomeButton } from "./components/ReturnHomeButton";
import { WelcomeBackBanner } from "./components/WelcomeBackBanner";
import { LaunchModePanel } from "./components/LaunchModePanel";
import { PlatformInstallPrompt } from "./components/PlatformInstallPrompt";
import { PlatformSubscriptionPanel } from "./components/PlatformSubscriptionPanel";
import { AccountPlatforms } from "./components/AccountPlatforms";
import { KioskModePanel } from "./components/KioskModePanel";
import { ContentRow } from "./components/ContentRow";
import { DetailSheet } from "./components/DetailSheet";
import { HeroBanner } from "./components/HeroBanner";
import { OverlayPortal } from "./components/OverlayPortal";
import { PopcornSplash } from "./components/PopcornSplash";
import { PosterCard } from "./components/PosterCard";
import { SearchBar } from "./components/SearchBar";
import { SmartSetup, shouldShowSmartSetup } from "./components/SmartSetup";
import { GoogleTvLauncher } from "./components/GoogleTvLauncher";
import { InstallAppBanner } from "./components/InstallAppBanner";
import { IptvApp } from "./components/IptvApp";
import { Capacitor } from "@capacitor/core";
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
  const [manualOpenPlatform, setManualOpenPlatform] = useState<PlatformId | null>(null);
  const [welcomeBack, setWelcomeBack] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptPayload | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  const featured = CATALOG.find((i) => i.featured) ?? CATALOG[0]!;

  useTvRemote(mainRef);

  useEffect(() => {
    enterAppShellMode();
    if (wasPlatformOpened()) {
      clearAllReturnFlags();
    }
    return () => exitAppShellMode();
  }, []);

  useEffect(() => {
    if (isKioskEnabled()) void enterKioskMode();
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
    if (installPrompt) {
      setInstallPrompt(null);
      return true;
    }
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

  usePendingPlatformRetry({
    onOpenedApp: (url) => {
      setInstallPrompt(null);
      setListHint(`تم فتح التطبيق — «${url.slice(0, 40)}…»`);
    },
    onStillPending: () => {
      /* user returned without installing */
    },
  });

  useReturnToHome({
    onReturnHome: resetToHomeInterface,
    onWelcomeBack: () => setWelcomeBack(true),
    onBackStep: handleBackStep,
    isPlaybackActive: () => showPopcorn || launching !== null || installPrompt !== null,
  });

  function openDetails(item: CatalogItem) {
    setSelected(item);
    pushOverlayHistory();
  }

  function handleReturnHomeClick() {
    clearAllReturnFlags();
    setManualOpenUrl(null);
    setManualOpenPlatform(null);
    setWelcomeBack(false);
    resetToHomeInterface();
  }

  function startPlayback(
    item: CatalogItem,
    platform: CatalogItem["platforms"][0]["platform"],
    url: string,
  ) {
    enterPlaybackMode();
    launchOnPlatform(
      item,
      platform,
      url,
      (state) => {
        prepareLaunch(state);
        const result = openPlatformBrowserSync(state);
        flushSync(() => {
          setLaunching(state);
          setShowPopcorn(true);
        });
        if (result.needsManualOpen) setManualOpenUrl(result.destination);
      },
      () => {
        setContinueItems(mapContinueToItems(getContinueWatching()));
        setListHint(`«${item.title}» — تطبيق أو Play Store · أو متصفح`);
      },
    );
  }

  function handlePopcornDone() {
    if (!launching) return;
    const current = launching;
    void finishPopcornOverlay(current).then((result) => {
      setShowPopcorn(false);
      setLaunching(null);
      if (result.installPrompt) {
        void exitPlaybackMode();
        setInstallPrompt(result.installPrompt);
        return;
      }
      if (!result.success) {
        void exitPlaybackMode();
        setManualOpenUrl(result.destination);
        setManualOpenPlatform(current.platform);
        return;
      }
      /* success + same-tab navigation to Netflix — page unloads; keep fullscreen until then */
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
        <div className="gtv-header__actions">
          <button type="button" className="gtv-header__max-home" onClick={handleReturnHomeClick}>
            ← MAX
          </button>
          <button type="button" className="gtv-header__logout" onClick={onLogout}>
            خروج
          </button>
        </div>
      </header>

      <InstallAppBanner />

      {Capacitor.isNativePlatform() ? (
        <p className="gtv-scroll-hint">⬆⬇ للتمرير · ⬅➡ بين الأفلام · OK للاختيار</p>
      ) : null}

      {installPrompt ? (
        <PlatformInstallPrompt
          platform={installPrompt.platform}
          title={installPrompt.title}
          onInstallPlayStore={() => {
            void confirmInstallFromPlayStore(
              installPrompt.platform,
              installPrompt.url,
              installPrompt.title,
            ).then((ok) => {
              if (ok) setInstallPrompt(null);
            });
          }}
          onOpenBrowser={() => {
            void confirmBrowserPlayback(installPrompt.url).then((ok) => {
              if (ok) setInstallPrompt(null);
            });
          }}
          onCancel={() => setInstallPrompt(null)}
        />
      ) : null}

      {welcomeBack ? (
        <WelcomeBackBanner onDismiss={() => setWelcomeBack(false)} />
      ) : null}

      {manualOpenUrl ? (
        <div className="manual-open-banner">
          <p>لم يُفتح الرابط — جرّب مرة أخرى من المتصفح داخل MAX</p>
          <button
            type="button"
            className="manual-open-banner__btn"
            onClick={() => {
              const platform = manualOpenPlatform ?? "netflix";
              void openPlatformManually(platform, manualOpenUrl).then((ok) => {
                if (ok) {
                  setManualOpenUrl(null);
                  setManualOpenPlatform(null);
                }
              });
            }}
          >
            ▶ إعادة فتح في المتصفح
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
        <main ref={mainRef} tabIndex={-1} className="gtv-main">
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
        <main ref={mainRef} tabIndex={-1} className="gtv-main">
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
        <main ref={mainRef} tabIndex={-1} className="gtv-main gtv-main--padded">
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
        <main ref={mainRef} tabIndex={-1} className="gtv-main gtv-main--padded">
          <PlatformSubscriptionPanel />
          <LaunchModePanel />
          <KioskModePanel />
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
      <ReturnHomeButton onClick={handleReturnHomeClick} forceVisible={welcomeBack} />
    </div>
  );
}

export { HomePage as CatalogHomePage };

export function App() {
  const [setupDone, setSetupDone] = useState(() => !shouldShowSmartSetup());

  useEffect(() => {
    enterAppShellMode();
  }, []);

  if (!setupDone) {
    return (
      <GoogleTvLauncher>
        <SmartSetup onDone={() => setSetupDone(true)} />
      </GoogleTvLauncher>
    );
  }

  return (
    <GoogleTvLauncher>
      <IptvApp />
    </GoogleTvLauncher>
  );
}
