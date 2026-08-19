/** Upload exported edit-studio MP4 to home feed. */
export async function publishEditExportToHome(input: {
  blob: Blob;
  filename: string;
  prompt?: string;
  aspectRatio?: string;
}): Promise<{ ok: boolean; assetId?: string; error?: string }> {
  const form = new FormData();
  form.set("file", input.blob, input.filename);
  if (input.prompt?.trim()) form.set("prompt", input.prompt.trim());
  if (input.aspectRatio?.trim()) form.set("aspectRatio", input.aspectRatio.trim());

  const res = await fetch("/api/edit-studio/publish", {
    method: "POST",
    credentials: "include",
    body: form,
  });

  const data = (await res.json()) as {
    ok?: boolean;
    assetId?: string;
    error?: string;
  };

  if (!res.ok) {
    return { ok: false, error: data.error || "Publish failed" };
  }

  return { ok: true, assetId: data.assetId };
}

export function publicFeedVideoSrc(assetId: string): string {
  const qs = new URLSearchParams({ assetId, type: "video" });
  return `/api/media/public-stream?${qs.toString()}`;
}
