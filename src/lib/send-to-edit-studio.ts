import {
  appendClipsToTimeline,
  type ClipInput,
} from "@/lib/edit-studio-timeline";

export type SendToEditStudioInput = ClipInput;

/** Append one or more clips to the timeline and open Editing Studio. */
export function sendVideosToEditStudio(
  router: { push: (href: string) => void },
  inputs: SendToEditStudioInput[],
) {
  const valid = inputs.filter((i) => i.videoUrl?.trim());
  if (!valid.length) return;
  appendClipsToTimeline(valid);
  router.push("/edit");
}

/** Append a single clip (does not overwrite existing timeline). */
export function sendVideoToEditStudio(
  router: { push: (href: string) => void },
  input: SendToEditStudioInput,
) {
  sendVideosToEditStudio(router, [input]);
}
