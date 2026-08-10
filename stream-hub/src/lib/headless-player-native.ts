import { Capacitor, registerPlugin } from "@capacitor/core";

export type HeadlessPlaybackState = "idle" | "buffering" | "playing" | "paused" | "ended";

export type HeadlessPlayerPlugin = {
  startPlayback(options: {
    url: string;
    title?: string;
    showSurface?: boolean;
  }): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seekTo(options: { positionMs: number }): Promise<void>;
  stop(): Promise<void>;
  addListener(
    event: "playbackState",
    handler: (payload: {
      state: HeadlessPlaybackState;
      positionMs: number;
      durationMs: number;
    }) => void,
  ): Promise<{ remove: () => void }>;
};

const HeadlessPlayer = registerPlugin<HeadlessPlayerPlugin>("HeadlessPlayer");

export function isNativeHeadlessAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

export async function startNativeHeadlessPlayback(
  url: string,
  title: string,
  showSurface = true,
): Promise<boolean> {
  if (!isNativeHeadlessAvailable()) return false;
  try {
    await HeadlessPlayer.startPlayback({ url, title, showSurface });
    return true;
  } catch {
    return false;
  }
}

export async function stopNativeHeadlessPlayback(): Promise<void> {
  if (!isNativeHeadlessAvailable()) return;
  try {
    await HeadlessPlayer.stop();
  } catch {
    /* ignore */
  }
}

export { HeadlessPlayer };
