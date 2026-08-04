type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

export function isFullscreen(): boolean {
  const doc = document as FullscreenDocument;
  return Boolean(document.fullscreenElement ?? doc.webkitFullscreenElement);
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
    /* Safari may reject without direct user gesture */
  }
  return false;
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
