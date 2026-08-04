type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

export const THEATER_CLASS = "stream-hub-theater";

export function isFullscreen(): boolean {
  const doc = document as FullscreenDocument;
  return Boolean(document.fullscreenElement ?? doc.webkitFullscreenElement);
}

export function isTheaterMode(): boolean {
  return document.documentElement.classList.contains(THEATER_CLASS);
}

export function enterTheaterMode(): void {
  document.documentElement.classList.add(THEATER_CLASS);
  document.body.classList.add(THEATER_CLASS);
}

export function exitTheaterMode(): void {
  document.documentElement.classList.remove(THEATER_CLASS);
  document.body.classList.remove(THEATER_CLASS);
}

/** Theater CSS + document fullscreen — safe on user click (login ACTIVATE / play). */
export function enterPlaybackMode(): void {
  enterTheaterMode();
  const el = document.documentElement as FullscreenElement;
  try {
    if (typeof el.requestFullscreen === "function") {
      void el.requestFullscreen();
      return;
    }
    if (typeof el.webkitRequestFullscreen === "function") {
      el.webkitRequestFullscreen();
    }
  } catch {
    /* theater CSS covers viewport */
  }
}

export async function exitPlaybackMode(): Promise<void> {
  exitTheaterMode();
  await exitFullscreen();
}

export async function exitFullscreen(): Promise<void> {
  if (!isFullscreen()) return;
  const doc = document as FullscreenDocument;
  try {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
      return;
    }
    if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen();
    }
  } catch {
    /* ignore */
  }
}
