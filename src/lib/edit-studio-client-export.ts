import type { EditStudioExportQuality } from "@/lib/edit-studio-export-quality";
import type { TimelineClip } from "@/lib/edit-studio-timeline";

/** High-quality export via server ffmpeg — avoids browser WASM memory/audio limits. */
export async function exportEditStudioViaServer(input: {
  clips: TimelineClip[];
  quality: EditStudioExportQuality;
  merge: boolean;
}): Promise<Blob> {
  const res = await fetch("/api/edit-studio/export", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clips: input.clips,
      quality: input.quality,
      merge: input.merge,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    try {
      const data = JSON.parse(text) as { error?: string };
      throw new Error(data.error || `Server export failed (${res.status})`);
    } catch (err) {
      if (err instanceof Error && err.message.includes("export")) throw err;
      throw new Error(text.slice(0, 200) || `Server export failed (${res.status})`);
    }
  }

  return await res.blob();
}
