import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

type ReturnListener = () => void;

let returnListener: ReturnListener | undefined;
let listenerReady = false;

async function ensureBrowserListener(): Promise<void> {
  if (listenerReady || !Capacitor.isNativePlatform()) return;
  listenerReady = true;
  await Browser.addListener("browserFinished", () => {
    returnListener?.();
  });
}

export function onPlatformBrowserClosed(listener: ReturnListener): () => void {
  returnListener = listener;
  void ensureBrowserListener();
  return () => {
    if (returnListener === listener) returnListener = undefined;
  };
}

export async function openPlatformWebView(url: string): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      await ensureBrowserListener();
      await Browser.open({
        url,
        toolbarColor: "#070b18",
        windowName: "_self",
      });
      return true;
    }
    window.location.assign(url);
    return true;
  } catch {
    try {
      window.open(url, "_blank", "noopener,noreferrer");
      return true;
    } catch {
      return false;
    }
  }
}

export async function closePlatformBrowser(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Browser.close();
  } catch {
    /* already closed */
  }
}
