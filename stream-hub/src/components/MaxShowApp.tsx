import { useEffect, useRef, useState } from "react";
import type { MainNavId } from "../lib/movie-categories";
import { enterAppShellMode } from "../lib/app-shell";
import { clearAllReturnFlags, wasPlatformOpened } from "../lib/app-navigation";
import { enterKioskMode } from "../lib/kiosk-mode";
import { useTvRemote } from "../hooks/useTvRemote";
import { MaxShowFavoritesView } from "./MaxShowFavoritesView";
import { MaxShowLiveView } from "./MaxShowLiveView";
import { MaxShowMoviesView } from "./MaxShowMoviesView";
import { MaxShowSeriesView } from "./MaxShowSeriesView";
import { MaxShowSidebar } from "./MaxShowSidebar";
import { ReturnHomeButton } from "./ReturnHomeButton";

export function MaxShowApp() {
  const [nav, setNav] = useState<MainNavId>("live");
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
    <div className="mstv-app">
      <MaxShowSidebar active={nav} onChange={setNav} />

      <div className="mstv-app__stage">
        <div className="mstv-app__dots mstv-app__dots--cyan" aria-hidden="true" />
        <div className="mstv-app__dots mstv-app__dots--magenta" aria-hidden="true" />

        <main ref={mainRef} tabIndex={-1} className="mstv-app__main">
          {nav === "live" ? <MaxShowLiveView /> : null}
          {nav === "movies" ? <MaxShowMoviesView /> : null}
          {nav === "series" ? <MaxShowSeriesView /> : null}
          {nav === "favorites" ? <MaxShowFavoritesView /> : null}
        </main>
      </div>

      {wasPlatformOpened() ? <ReturnHomeButton onClick={handleReturnHome} /> : null}
    </div>
  );
}
