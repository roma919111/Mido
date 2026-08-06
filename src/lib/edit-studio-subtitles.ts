import {
  getEffectiveDialogueCues,
  resolveCueTimelineDuration,
  subtitleDisplayText,
} from "@/lib/edit-studio-dialogue";
import type { EditStudioAspect } from "@/lib/edit-studio-draft";
import type { DialogueCue, TimelineClip } from "@/lib/edit-studio-timeline";

export type { SubtitleBackground, SubtitlePosition, SubtitleSize } from "@/lib/edit-studio-timeline";
import type { SubtitleBackground, SubtitlePosition, SubtitleSize } from "@/lib/edit-studio-timeline";

export const SUBTITLE_FONT_PX: Record<SubtitleSize, number> = {
  small: 26,
  medium: 34,
  large: 44,
};

const CAIRO_WOFF2 =
  "https://fonts.gstatic.com/s/cairo/v28/SLXgc1nY6HkvangtZmpQdkhzfH5lkSscQyyS4J0.woff2";

let cairoFontReady: Promise<void> | null = null;

export type TimedSubtitlePng = {
  png: Uint8Array;
  startSec: number;
  endSec: number;
};

export function exportDimensions(aspect: EditStudioAspect): { w: number; h: number } {
  switch (aspect) {
    case "9:16":
      return { w: 720, h: 1280 };
    case "1:1":
      return { w: 1080, h: 1080 };
    default:
      return { w: 1280, h: 720 };
  }
}

export function ensureCairoFont(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (cairoFontReady) return cairoFontReady;
  cairoFontReady = (async () => {
    try {
      if (document.fonts.check('700 16px "Cairo"')) return;
      const face = new FontFace("Cairo", `url(${CAIRO_WOFF2})`, {
        weight: "700",
        style: "normal",
      });
      await face.load();
      document.fonts.add(face);
      await document.fonts.load('700 34px "Cairo"');
    } catch {
      // Browser fallback — Tajawal/system Arabic fonts in CSS
    }
  })();
  return cairoFontReady;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  if (!words.length) return [];
  const lines: string[] = [];
  let line = words[0]!;
  for (let i = 1; i < words.length; i += 1) {
    const next = `${line} ${words[i]}`;
    if (ctx.measureText(next).width <= maxWidth) line = next;
    else {
      lines.push(line);
      line = words[i]!;
    }
  }
  lines.push(line);
  return lines;
}

function blockTop(
  position: SubtitlePosition,
  canvasH: number,
  blockHeight: number,
): number {
  const pad = Math.round(canvasH * 0.06);
  if (position === "top") return pad;
  if (position === "center") return Math.max(pad, (canvasH - blockHeight) / 2);
  return Math.max(pad, canvasH - blockHeight - pad);
}

type RenderSubtitleOpts = {
  size: SubtitleSize;
  position: SubtitlePosition;
  background: SubtitleBackground;
  aspect: EditStudioAspect;
  speaker?: string;
  text: string;
};

async function renderSubtitleCanvas(opts: RenderSubtitleOpts): Promise<Uint8Array | null> {
  const text = opts.text.trim();
  if (!text || typeof document === "undefined") return null;

  await ensureCairoFont();
  const { w, h } = exportDimensions(opts.aspect);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const fontPx = SUBTITLE_FONT_PX[opts.size];
  const speakerPx = Math.max(18, Math.round(fontPx * 0.62));
  const speaker = opts.speaker?.trim() ?? "";

  ctx.clearRect(0, 0, w, h);
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const maxTextW = w * 0.88;
  ctx.font = `700 ${fontPx}px "Cairo", "Tajawal", sans-serif`;
  const dialogueLines = wrapLines(ctx, text, maxTextW);
  if (!dialogueLines.length) return null;

  let speakerLines: string[] = [];
  if (speaker) {
    ctx.font = `700 ${speakerPx}px "Cairo", "Tajawal", sans-serif`;
    speakerLines = wrapLines(ctx, speaker, maxTextW);
  }

  const lineHeight = fontPx * 1.38;
  const speakerLineHeight = speakerPx * 1.3;
  const speakerGap = speaker ? speakerPx * 0.35 : 0;
  const blockHeight =
    speakerLines.length * speakerLineHeight +
    speakerGap +
    dialogueLines.length * lineHeight;
  const startY = blockTop(opts.position, h, blockHeight);

  const paddingX = fontPx * 0.55;
  const paddingY = fontPx * 0.35;

  ctx.font = `700 ${fontPx}px "Cairo", "Tajawal", sans-serif`;
  let maxLineW = 0;
  if (speakerLines.length) {
    ctx.font = `700 ${speakerPx}px "Cairo", "Tajawal", sans-serif`;
    for (const line of speakerLines) {
      maxLineW = Math.max(maxLineW, ctx.measureText(line).width);
    }
  }
  ctx.font = `700 ${fontPx}px "Cairo", "Tajawal", sans-serif`;
  for (const line of dialogueLines) {
    maxLineW = Math.max(maxLineW, ctx.measureText(line).width);
  }

  const boxW = Math.min(maxTextW, maxLineW + paddingX * 2);
  const boxH = blockHeight + paddingY * 2;
  const boxX = (w - boxW) / 2;
  const boxY = startY - paddingY;

  if (opts.background === "box") {
    const r = 10;
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.beginPath();
    ctx.moveTo(boxX + r, boxY);
    ctx.lineTo(boxX + boxW - r, boxY);
    ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + r);
    ctx.lineTo(boxX + boxW, boxY + boxH - r);
    ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - r, boxY + boxH);
    ctx.lineTo(boxX + r, boxY + boxH);
    ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - r);
    ctx.lineTo(boxX, boxY + r);
    ctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
    ctx.closePath();
    ctx.fill();
  }

  let yCursor = startY;
  if (speakerLines.length) {
    ctx.font = `700 ${speakerPx}px "Cairo", "Tajawal", sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    for (const line of speakerLines) {
      ctx.fillText(line, w / 2, yCursor + speakerLineHeight / 2);
      yCursor += speakerLineHeight;
    }
    yCursor += speakerGap;
  }

  ctx.font = `700 ${fontPx}px "Cairo", "Tajawal", sans-serif`;
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < dialogueLines.length; i += 1) {
    const y = yCursor + i * lineHeight + lineHeight / 2;
    if (opts.background === "shadow") {
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
    } else {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    }
    ctx.fillText(dialogueLines[i]!, w / 2, y);
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/png");
  });
  if (!blob) return null;
  return new Uint8Array(await blob.arrayBuffer());
}

export async function renderSubtitlePngForCue(
  clip: TimelineClip,
  cue: DialogueCue,
): Promise<Uint8Array | null> {
  return renderSubtitleCanvas({
    size: clip.subtitleSize ?? "medium",
    position: clip.subtitlePosition ?? "bottom",
    background: clip.subtitleBackground ?? "box",
    aspect: clip.exportAspect,
    speaker: cue.speaker,
    text: cue.text,
  });
}

/** Timed subtitle PNGs for export (one overlay per cue). */
export async function renderTimedSubtitlePngs(
  clip: TimelineClip,
  playDuration: number,
): Promise<TimedSubtitlePng[]> {
  const maxDur = resolveCueTimelineDuration(clip, playDuration, clip.dialogueCues);
  const cues = getEffectiveDialogueCues(clip, maxDur);
  const out: TimedSubtitlePng[] = [];
  for (const cue of cues) {
    const png = await renderSubtitlePngForCue(clip, cue);
    if (png?.length) {
      out.push({ png, startSec: cue.startSec, endSec: cue.endSec });
    }
  }
  return out;
}

/** Legacy single-block subtitle for whole clip. */
export async function renderSubtitlePng(clip: TimelineClip): Promise<Uint8Array | null> {
  const text = clip.dialogueText?.trim();
  if (!text) return null;
  return renderSubtitleCanvas({
    size: clip.subtitleSize ?? "medium",
    position: clip.subtitlePosition ?? "bottom",
    background: clip.subtitleBackground ?? "box",
    aspect: clip.exportAspect,
    text,
  });
}

export function subtitlePreviewClasses(
  clip: TimelineClip,
  overrides?: Partial<{
    subtitleSize: SubtitleSize;
    subtitleBackground: SubtitleBackground;
    subtitlePosition: SubtitlePosition;
  }>,
): {
  wrap: string;
  text: string;
  speaker: string;
} {
  const size = overrides?.subtitleSize ?? clip.subtitleSize ?? "medium";
  const background = overrides?.subtitleBackground ?? clip.subtitleBackground ?? "box";
  const position = overrides?.subtitlePosition ?? clip.subtitlePosition ?? "bottom";

  const wrapPos =
    position === "top"
      ? "top-0 pt-[6%]"
      : position === "center"
        ? "top-1/2 -translate-y-1/2"
        : "bottom-0 pb-[6%]";

  const textSize =
    size === "small"
      ? "text-sm sm:text-base"
      : size === "large"
        ? "text-lg sm:text-xl"
        : "text-base sm:text-lg";

  const textBg =
    background === "box"
      ? "rounded-xl bg-black/70 px-3 py-2"
      : background === "shadow"
        ? "px-2 py-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]"
        : "px-2 py-1";

  return {
    wrap: `absolute inset-x-0 z-10 flex flex-col items-center px-4 ${wrapPos}`,
    speaker: `max-w-[92%] text-center text-[11px] font-semibold leading-snug text-white/80 sm:text-xs ${textBg}`,
    text: `max-w-[92%] text-center font-bold leading-relaxed text-white ${textSize} ${background === "box" ? "" : textBg}`,
  };
}

export { subtitleDisplayText };
