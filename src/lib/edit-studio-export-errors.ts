/** Map FFmpeg.wasm technical errors to user-friendly export messages. */
export function humanizeExportError(message: string, labels: {
  failed: string;
  audioFailed: string;
  memoryFailed: string;
}): string {
  const m = message.toLowerCase();
  if (
    m.includes("audio fallback") ||
    m.includes("acrossfade") ||
    (m.includes("transition") && m.includes("audio"))
  ) {
    return labels.audioFailed;
  }
  if (m.includes("transition") && !m.includes("video only")) {
    return labels.audioFailed;
  }
  if (m.includes("memory") || m.includes("out of memory") || m.includes("oom")) {
    return labels.memoryFailed;
  }
  if (m.includes("failed")) {
    return labels.failed;
  }
  return message || labels.failed;
}
