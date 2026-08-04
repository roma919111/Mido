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

function tryFullscreenOn(target: Element): boolean {
  const el = target as FullscreenElement;
  try {
    if (typeof el.requestFullscreen === "function") {
      void el.requestFullscreen();
      return true;
    }
    if (typeof el.webkitRequestFullscreen === "function") {
      el.webkitRequestFullscreen();
      return true;
    }
  } catch {
    /* try next target */
  }
  return false;
}

/** Theater CSS + native fullscreen — call synchronously inside a click handler. */
export function enterPlaybackMode(fromElement?: Element | null): void {
  enterTheaterMode();

  const targets: Element[] = [];
  if (fromElement) targets.push(fromElement);
  targets.push(document.documentElement, document.body);

  for (const target of targets) {
    if (tryFullscreenOn(target)) return;
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
