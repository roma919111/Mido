import type { EditStudioExportQuality } from "@/lib/edit-studio-export-quality";
import { exportEditStudioViaServer } from "@/lib/edit-studio-client-export";
import { humanizeExportError } from "@/lib/edit-studio-export-errors";
import {
  createVideoBlobUrl,
  deliverExportInTab,
  downloadBlob,
  exportSingleClip,
  mergeTimelineClips,
  openExportDeliveryTab,
  prefetchClipBytes,
  resetExportFfmpeg,
  revokeVideoBlobUrl,
  showExportErrorInTab,
  updateExportDeliveryTab,
} from "@/lib/edit-studio-ffmpeg";
import type { TimelineClip } from "@/lib/edit-studio-timeline";

export type EditStudioExportJobState = {
  active: boolean;
  pct: number;
  phase: "idle" | "prefetch" | "encode" | "done" | "error";
  message: string;
  error: string | null;
  downloadUrl: string | null;
  downloadFilename: string | null;
  exportPrompt: string | null;
  exportAspect: string | null;
};

export type EditStudioExportLabels = {
  loadingClips: string;
  exporting: string;
  serverExporting: string;
  done: string;
  doneTab: string;
  failed: string;
  audioFailed: string;
  memoryFailed: string;
  backgroundHint: string;
};

type Listener = (state: EditStudioExportJobState) => void;

let state: EditStudioExportJobState = {
  active: false,
  pct: 0,
  phase: "idle",
  message: "",
  error: null,
  downloadUrl: null,
  downloadFilename: null,
  exportPrompt: null,
  exportAspect: null,
};

const listeners = new Set<Listener>();
let hideDoneTimer: ReturnType<typeof setTimeout> | null = null;
let lastExportToken = 0;
let deliveryTab: Window | null = null;
let emitScheduled = false;
let emitPending = false;

function emitNow() {
  const snapshot = { ...state };
  for (const listener of listeners) {
    listener(snapshot);
  }
  if (deliveryTab && !deliveryTab.closed && state.active) {
    updateExportDeliveryTab(deliveryTab, state.pct, state.message);
  }
}

function emit() {
  if (emitScheduled) {
    emitPending = true;
    return;
  }
  emitScheduled = true;
  requestAnimationFrame(() => {
    emitScheduled = false;
    emitNow();
    if (emitPending) {
      emitPending = false;
      emit();
    }
  });
}

function setState(patch: Partial<EditStudioExportJobState>) {
  state = { ...state, ...patch };
  emit();
}

function clearStoredDownload() {
  revokeVideoBlobUrl(state.downloadUrl);
}

export function getEditStudioExportState(): EditStudioExportJobState {
  return { ...state };
}

export function subscribeEditStudioExport(listener: Listener): () => void {
  listeners.add(listener);
  listener({ ...state });
  return () => listeners.delete(listener);
}

export function isEditStudioExportActive(): boolean {
  return state.active;
}

async function exportViaWasm(input: {
  clips: TimelineClip[];
  merge: boolean;
  quality: EditStudioExportQuality;
  exportToken: number;
  labels: EditStudioExportLabels;
}) {
  const { clips, merge, quality, exportToken, labels } = input;
  const shouldMerge = merge && clips.length > 1;

  const byteCache = await prefetchClipBytes(clips, (pct) => {
    if (exportToken !== lastExportToken) return;
    setState({
      pct,
      phase: "prefetch",
      message: labels.loadingClips,
    });
  });

  if (exportToken !== lastExportToken) return null;

  setState({
    pct: 0,
    phase: "encode",
    message: labels.exporting,
  });

  const exportOptions = { byteCache, quality };

  return shouldMerge
    ? await mergeTimelineClips(clips, (pct) => {
        if (exportToken !== lastExportToken) return;
        setState({ pct, phase: "encode", message: labels.exporting });
      }, exportOptions)
    : await exportSingleClip(clips[0]!, (pct) => {
        if (exportToken !== lastExportToken) return;
        setState({ pct, phase: "encode", message: labels.exporting });
      }, exportOptions);
}

/** Runs export outside React — survives leaving /edit. */
export function runEditStudioExport(input: {
  clips: TimelineClip[];
  filename: string;
  merge: boolean;
  labels: EditStudioExportLabels;
  /** Pass tab opened synchronously on button click. */
  deliveryTab?: Window | null;
  quality?: EditStudioExportQuality;
  exportPrompt?: string;
  exportAspect?: string;
}): boolean {
  if (state.active) return false;

  const clips = input.clips.map((clip) => ({ ...clip }));
  const exportToken = ++lastExportToken;
  deliveryTab = input.deliveryTab ?? null;
  const quality = input.quality ?? "standard";
  const shouldMerge = input.merge && clips.length > 1;

  if (hideDoneTimer) {
    clearTimeout(hideDoneTimer);
    hideDoneTimer = null;
  }

  clearStoredDownload();

  setState({
    active: true,
    pct: 0,
    phase: quality === "high" ? "encode" : "prefetch",
    message: quality === "high" ? input.labels.serverExporting : input.labels.loadingClips,
    error: null,
    downloadUrl: null,
    downloadFilename: null,
    exportPrompt: input.exportPrompt?.trim() || null,
    exportAspect: input.exportAspect?.trim() || null,
  });

  void (async () => {
    try {
      let blob: Blob | null = null;

      if (quality === "high") {
        setState({ pct: 12, phase: "encode", message: input.labels.serverExporting });
        try {
          blob = await exportEditStudioViaServer({
            clips,
            quality,
            merge: shouldMerge,
          });
          if (exportToken !== lastExportToken) return;
          setState({ pct: 95, phase: "encode", message: input.labels.serverExporting });
        } catch {
          resetExportFfmpeg();
          blob = await exportViaWasm({
            clips,
            merge: input.merge,
            quality,
            exportToken,
            labels: input.labels,
          });
        }
      } else {
        blob = await exportViaWasm({
          clips,
          merge: input.merge,
          quality,
          exportToken,
          labels: input.labels,
        });
      }

      if (exportToken !== lastExportToken || !blob) return;

      const downloadUrl = createVideoBlobUrl(blob);
      let deliveredInTab = false;
      if (deliveryTab && !deliveryTab.closed) {
        deliveredInTab = deliverExportInTab(deliveryTab, blob, input.filename);
      }
      if (!deliveredInTab) {
        downloadBlob(blob, input.filename);
      }

      setState({
        active: false,
        pct: 100,
        phase: "done",
        message: input.labels.done,
        error: null,
        downloadUrl,
        downloadFilename: input.filename,
      });

      hideDoneTimer = setTimeout(() => {
        if (state.phase === "done" && !state.active) {
          setState({ phase: "idle", message: "", pct: 0 });
        }
      }, 30_000);
    } catch (err) {
      if (exportToken !== lastExportToken) return;
      const raw = err instanceof Error ? err.message : input.labels.failed;
      const msg = humanizeExportError(raw, {
        failed: input.labels.failed,
        audioFailed: input.labels.audioFailed,
        memoryFailed: input.labels.memoryFailed,
      });
      showExportErrorInTab(deliveryTab, msg);
      deliveryTab = null;
      clearStoredDownload();
      setState({
        active: false,
        pct: 0,
        phase: "error",
        message: "",
        error: msg,
        downloadUrl: null,
        downloadFilename: null,
        exportPrompt: null,
        exportAspect: null,
      });
    }
  })();

  return true;
}
