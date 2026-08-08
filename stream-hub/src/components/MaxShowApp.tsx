import { useEffect, useRef, useState } from "react";
import type { MainNavId } from "../lib/movie-categories";
import { enterAppShellMode } from "../lib/app-shell";
import { clearAllReturnFlags } from "../lib/app-navigation";
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
  const [toast, setToast] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  useTvRemote(mainRef);

  useEffect(() => {
    enterAppShellMode();
    void enterKioskMode();
  }, []);

  useEffect(() => {
    function onPlayError(e: Event) {
      const msg = (e as CustomEvent<string>).detail;
      setToast(msg);
      window.setTimeout(() => setToast(null), 4500);
    }
    window.addEventListener("max-play-error", onPlayError);
    return () => window.removeEventListener("max-play-error", onPlayError);
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

      <ReturnHomeButton onClick={handleReturnHome} />

      {import.meta.env.VITE_DEMO_MODE === "true" ? (
        <div className="mstv-demo-badge" role="status">
          موقع تجريبي · TMDB + Netflix deeplink
        </div>
      ) : null}

      {toast ? (
        <div className="mstv-toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
