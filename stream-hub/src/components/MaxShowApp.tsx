import { useEffect, useRef, useState } from "react";
import type { PlatformId } from "../types";
import { enterAppShellMode } from "../lib/app-shell";
import { clearAllReturnFlags } from "../lib/app-navigation";
import { enterKioskMode } from "../lib/kiosk-mode";
import { useTvRemote } from "../hooks/useTvRemote";
import { OttPlatformView } from "./OttPlatformView";
import { OttSidebar } from "./OttSidebar";
import { ReturnHomeButton } from "./ReturnHomeButton";

/** MAX SHOW TV — official apps only (Netflix / Shahid / TOD) + TMDB. No IPTV/M3U. */
export function MaxShowApp() {
  const [platform, setPlatform] = useState<PlatformId>("netflix");
  const mainRef = useRef<HTMLElement>(null);

  useTvRemote(mainRef);

  useEffect(() => {
    enterAppShellMode();
    void enterKioskMode();
  }, []);

  function handleReturnHome() {
    clearAllReturnFlags();
  }

  return (
    <div className="max-show">
      <OttSidebar active={platform} onChange={setPlatform} />

      <div className="max-show__main">
        <div className="max-show__pattern" aria-hidden="true" />

        <header className="max-show__header">
          <span className="max-show__header-title">MAX SHOW TV</span>
          <span className="max-show__version">v{__APP_VERSION__}</span>
        </header>

        <main ref={mainRef} tabIndex={-1} className="max-show__content">
          <OttPlatformView platform={platform} />
        </main>
      </div>

      <ReturnHomeButton onClick={handleReturnHome} />
    </div>
  );
}
