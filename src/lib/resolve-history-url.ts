import {
  getBytePlusVideoTask,
  parseBytePlusHistoryId,
} from "@/lib/byteplus-ark";
import {
  getPixVerseVideoTask,
  parsePixVerseHistoryId,
} from "@/lib/pixverse";
import {
  parseGeminiHistoryId,
  resolveGeminiVideoUrl,
} from "@/lib/gemini-video";
import {
  parseMiniMaxHistoryId,
  resolveMiniMaxVideoUrl,
} from "@/lib/minimax-video";

/** Resolve a remote MP4 URL from a Veronix history id (`bp:` or `pv:`). */
export async function resolveHistoryVideoUrl(
  historyId: string,
): Promise<string | null> {
  const trimmed = historyId.trim();
  if (!trimmed) return null;

  const bpId = parseBytePlusHistoryId(trimmed);
  if (bpId) {
    const task = await getBytePlusVideoTask(bpId);
    return task.content?.video_url || null;
  }

  const pvId = parsePixVerseHistoryId(trimmed);
  if (pvId) {
    const task = await getPixVerseVideoTask(pvId);
    return task.url || null;
  }

  const gmId = parseGeminiHistoryId(trimmed);
  if (gmId) {
    return resolveGeminiVideoUrl(gmId);
  }

  const mmId = parseMiniMaxHistoryId(trimmed);
  if (mmId) {
    return resolveMiniMaxVideoUrl(mmId);
  }

  return null;
}
