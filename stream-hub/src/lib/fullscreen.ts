type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

export const THEATER_CLASS = "stream-hub-theater";

function isSafariBrowser(): boolean {
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/Chrome|CriOS|Chromium|Edg|OPR|Firefox/i.test(ua);
}

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

/** Theater CSS fills the viewport. Native fullscreen on Safari targets the clicked button → white screen. */
export function enterPlaybackMode(): void {
  enterTheaterMode();

  if (isSafariBrowser()) return;

  const el = document.documentElement as FullscreenElement;
  try {
    if (typeof el.requestFullscreen === "function") {
      void el.requestFullscreen();
    }
  } catch {
    /* theater CSS is enough */
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
