import {
  appendClipsToTimeline,
  type ClipInput,
} from "@/lib/edit-studio-timeline";

export type SendToEditStudioInput = ClipInput;

/** Append clips to the timeline without navigating away. */
export function appendVideosToEditStudio(
  inputs: SendToEditStudioInput[],
): boolean {
  const valid = inputs.filter((i) => i.videoUrl?.trim());
  if (!valid.length) return false;
  appendClipsToTimeline(valid);
  return true;
}

/** Append one or more clips to the timeline and open Editing Studio. */
export function sendVideosToEditStudio(
  router: { push: (href: string) => void },
  inputs: SendToEditStudioInput[],
) {
  if (!appendVideosToEditStudio(inputs)) return;
  router.push("/edit");
}

/** Append a single clip (does not overwrite existing timeline). */
export function sendVideoToEditStudio(
  router: { push: (href: string) => void },
  input: SendToEditStudioInput,
  options?: { navigate?: boolean },
) {
  if (!appendVideosToEditStudio([input])) return;
  if (options?.navigate !== false) {
    router.push("/edit");
  }
}
