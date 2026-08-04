type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

const THEATER_CLASS = "stream-hub-theater";

export function isFullscreen(): boolean {
  const doc = document as FullscreenDocument;
  return Boolean(document.fullscreenElement ?? doc.webkitFullscreenElement);
}

export function isTheaterMode(): boolean {
  return document.documentElement.classList.contains(THEATER_CLASS);
}

export function enterTheaterMode(): void {
  document.documentElement.classList.add(THEATER_CLASS);
}

export function exitTheaterMode(): void {
  document.documentElement.classList.remove(THEATER_CLASS);
}

export async function enterFullscreen(): Promise<boolean> {
  const el = document.documentElement as FullscreenElement;
  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen();
      return isFullscreen();
    }
    if (el.webkitRequestFullscreen) {
      await el.webkitRequestFullscreen();
      return isFullscreen();
    }
  } catch {
    /* fallback to theater CSS */
  }
  return false;
}

/** Theater CSS + native fullscreen — call synchronously inside a click handler. */
export function enterPlaybackMode(): void {
  enterTheaterMode();
  void enterFullscreen();
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
