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
import { CustomVideoContainer } from "./CustomVideoContainer";
import { OttHandoffOverlay } from "./OttHandoffOverlay";
import type { InAppPlaybackSession, OttHandoffSession } from "../lib/playback-bridge";

export function MaxShowApp() {
  const [nav, setNav] = useState<MainNavId>("live");
  const [toast, setToast] = useState<string | null>(null);
  const [inAppPlayback, setInAppPlayback] = useState<InAppPlaybackSession | null>(null);
  const [ottHandoff, setOttHandoff] = useState<OttHandoffSession | null>(null);
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
    function onInApp(e: Event) {
      setInAppPlayback((e as CustomEvent<InAppPlaybackSession>).detail);
      setOttHandoff(null);
    }
    function onHandoff(e: Event) {
      setOttHandoff((e as CustomEvent<OttHandoffSession>).detail);
    }
    window.addEventListener("max-play-error", onPlayError);
    window.addEventListener("max-in-app-playback", onInApp);
    window.addEventListener("max-ott-handoff", onHandoff);
    return () => {
      window.removeEventListener("max-play-error", onPlayError);
      window.removeEventListener("max-in-app-playback", onInApp);
      window.removeEventListener("max-ott-handoff", onHandoff);
    };
  }, []);

  function handleReturnHome() {
    clearAllReturnFlags();
    setOttHandoff(null);
  }

  if (inAppPlayback) {
    return (
      <CustomVideoContainer
        title={inAppPlayback.title}
        streamUrl={inAppPlayback.streamUrl}
        posterUrl={inAppPlayback.posterUrl}
        onClose={() => setInAppPlayback(null)}
      />
    );
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

      {ottHandoff ? (
        <OttHandoffOverlay
          platform={ottHandoff.platform}
          title={ottHandoff.title}
          onDismiss={() => setOttHandoff(null)}
        />
      ) : null}
    </div>
  );
}
