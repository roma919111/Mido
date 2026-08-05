import { useEffect, useRef, useState } from "react";
import { CATALOG, ROWS } from "../data/catalog";
import { enterAppShellMode, exitAppShellMode } from "../lib/app-shell";
import { enterKioskMode, isKioskEnabled } from "../lib/kiosk-mode";
import { clearAllReturnFlags, wasPlatformOpened } from "../lib/app-navigation";
import { openCatalogItem } from "../lib/platform-open";
import { addContinueWatching, ensureInMyList, getContinueWatching, getContinueEntry } from "../lib/library";
import { pushOverlayHistory, useReturnToHome } from "../hooks/useReturnToHome";
import { useTvRemote } from "../hooks/useTvRemote";
import { ReturnHomeButton } from "./ReturnHomeButton";
import { PlatformLauncher } from "./PlatformLauncher";
import { PlatformSubscriptionPanel } from "./PlatformSubscriptionPanel";
import { ContentRow } from "./ContentRow";
import { DetailSheet } from "./DetailSheet";
import type { CatalogItem, PlatformId } from "../types";
import { toOfficialWebUrl } from "../lib/platforms";

type HomePageProps = {
  username: string;
  onLogout: () => void;
};

export function HomePage({ username, onLogout }: HomePageProps) {
  const [tab, setTab] = useState<"platforms" | "browse" | "account">("platforms");
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  useTvRemote(mainRef);

  useEffect(() => {
    enterAppShellMode();
    if (wasPlatformOpened()) clearAllReturnFlags();
    return () => exitAppShellMode();
  }, []);

  useEffect(() => {
    if (isKioskEnabled()) void enterKioskMode();
  }, []);

  useReturnToHome({
    onReturnHome: () => {
      setSelected(null);
      setTab("platforms");
    },
    onWelcomeBack: () => setTab("platforms"),
    onBackStep: () => {
      if (selected) {
        setSelected(null);
        return true;
      }
      if (tab !== "platforms") {
        setTab("platforms");
        return true;
      }
      return false;
    },
    isPlaybackActive: () => selected !== null,
  });

  function showToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(null), 4000);
  }

  async function playItem(item: CatalogItem, platform: PlatformId, url: string) {
    const webUrl = toOfficialWebUrl(url);
    addContinueWatching(item, platform, webUrl);
    ensureInMyList(item.id);
    const result = await openCatalogItem(platform, webUrl);
    if (result === "app") showToast(`✓ ${item.title} — في التطبيق`);
    else if (result === "store") showToast(`📥 ثبّت التطبيق ثم ▶ مرة أخرى`);
    else if (result === "browser") showToast(`🌐 ${item.title} — في المتصفح`);
  }

  function quickPlay(item: CatalogItem) {
    const saved = getContinueEntry(item.id);
    const link = saved
      ? { platform: saved.platform, url: saved.url }
      : item.platforms[0];
    if (!link) return;
    void playItem(item, link.platform, link.url);
  }

  const continueItems = getContinueWatching()
    .map((e) => CATALOG.find((i) => i.id === e.itemId))
    .filter((i): i is CatalogItem => Boolean(i));

  return (
    <div className="gtv-shell">
      <header className="gtv-header gtv-header--simple">
        <div className="gtv-header__brand">
          <span className="gtv-header__max">MAX</span> MEDIA PLAYER
          <span className="gtv-header__version">v{__APP_VERSION__}</span>
        </div>
        <button type="button" className="gtv-header__logout" onClick={onLogout}>
          خروج
        </button>
      </header>

      {toast ? <p className="gtv-toast">{toast}</p> : null}

      {tab === "platforms" ? (
        <main ref={mainRef} tabIndex={-1} className="gtv-main gtv-main--center">
          <PlatformLauncher onOpened={() => undefined} />
          {continueItems.length ? (
            <ContentRow
              title="شاهدت مؤخراً"
              items={continueItems.slice(0, 6)}
              onSelect={(item) => {
                setSelected(item);
                pushOverlayHistory();
              }}
              onPlay={quickPlay}
            />
          ) : null}
        </main>
      ) : tab === "browse" ? (
        <main ref={mainRef} tabIndex={-1} className="gtv-main">
          {ROWS.map((row) => (
            <ContentRow
              key={row.id}
              title={row.title}
              items={row.filter(CATALOG)}
              onSelect={(item) => {
                setSelected(item);
                pushOverlayHistory();
              }}
              onPlay={quickPlay}
            />
          ))}
        </main>
      ) : (
        <main ref={mainRef} tabIndex={-1} className="gtv-main gtv-main--padded">
          <p className="account-greeting">مرحباً {username}</p>
          <PlatformSubscriptionPanel />
        </main>
      )}

      <nav className="gtv-nav">
        <button
          type="button"
          className={tab === "platforms" ? "active" : ""}
          onClick={() => setTab("platforms")}
        >
          📺 المنصات
        </button>
        <button type="button" className={tab === "browse" ? "active" : ""} onClick={() => setTab("browse")}>
          🎬 تصفح
        </button>
        <button type="button" className={tab === "account" ? "active" : ""} onClick={() => setTab("account")}>
          👤 حسابي
        </button>
      </nav>

      <DetailSheet
        item={selected}
        onClose={() => setSelected(null)}
        onPlay={(item, platform, url) => {
          setSelected(null);
          void playItem(item, platform, url);
        }}
      />

      <ReturnHomeButton
        onClick={() => {
          clearAllReturnFlags();
          setSelected(null);
          setTab("platforms");
        }}
      />
    </div>
  );
}
