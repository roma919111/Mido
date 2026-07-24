"use client";

import { useMemo, useState } from "react";
import {
  Clapperboard,
  ImageIcon,
  Loader2,
  Paintbrush,
  Sparkles,
  WandSparkles,
  Zap,
} from "lucide-react";
import { useApp } from "@/components/providers/AppProviders";
import { estimateAppCredits } from "@/lib/models";
import type {
  AspectRatio,
  GenerationMode,
  GenerationRecord,
  StylePreset,
  VideoDuration,
  VideoQuality,
  VisualReference,
} from "@/lib/types";
import { ImageDropzone } from "./ImageDropzone";

const TABS: Array<{ id: GenerationMode; label: string; icon: typeof ImageIcon }> = [
  { id: "text-to-image", label: "Text to Image", icon: ImageIcon },
  { id: "text-to-video", label: "Text to Video", icon: Clapperboard },
  { id: "image-to-video", label: "Image to Video", icon: Sparkles },
  { id: "inpaint", label: "Inpaint / Edit", icon: Paintbrush },
];

const ASPECTS: Array<{ id: AspectRatio; label: string }> = [
  { id: "1:1", label: "1:1 Square" },
  { id: "16:9", label: "16:9 Landscape" },
  { id: "9:16", label: "9:16 Portrait" },
  { id: "4:3", label: "4:3" },
];

const STYLES: Array<{ id: StylePreset; label: string }> = [
  { id: "none", label: "No preset" },
  { id: "cinematic", label: "Cinematic" },
  { id: "anime", label: "Anime" },
  { id: "photorealistic", label: "Photorealistic" },
  { id: "cyberpunk", label: "Cyberpunk" },
  { id: "3d-render", label: "3D Render" },
];

interface Props {
  onGenerated?: (item: GenerationRecord) => void;
  initial?: Partial<{
    mode: GenerationMode;
    prompt: string;
    negativePrompt: string;
    stylePreset: StylePreset;
    aspectRatio: AspectRatio;
  }>;
}

export function GenerationWorkbench({ onGenerated, initial }: Props) {
  const { user, refreshUser, openPricing } = useApp();
  const [mode, setMode] = useState<GenerationMode>(initial?.mode ?? "text-to-image");
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const [negativePrompt, setNegativePrompt] = useState(initial?.negativePrompt ?? "");
  const [showNegative, setShowNegative] = useState(Boolean(initial?.negativePrompt));
  const [stylePreset, setStylePreset] = useState<StylePreset>(initial?.stylePreset ?? "cinematic");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(initial?.aspectRatio ?? "1:1");
  const [duration, setDuration] = useState<VideoDuration>(5);
  const [quality, setQuality] = useState<VideoQuality>("standard");
  const [isPublic, setIsPublic] = useState(false);
  const [startFrame, setStartFrame] = useState<VisualReference | null>(null);
  const [startPreview, setStartPreview] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<VisualReference | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [uploadingStart, setUploadingStart] = useState(false);
  const [uploadingRef, setUploadingRef] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const credits = useMemo(() => estimateAppCredits(mode), [mode]);
  const isVideo = mode === "text-to-video" || mode === "image-to-video";

  async function upload(file: File, target: "start" | "reference") {
    const localUrl = URL.createObjectURL(file);
    if (target === "start") {
      setUploadingStart(true);
      setStartPreview(localUrl);
    } else {
      setUploadingRef(true);
      setReferencePreview(localUrl);
    }

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("purpose", isVideo ? "create-video" : "create-image");
      form.append("label", file.name || target);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      if (target === "start") setStartFrame(data.visualReference);
      else setReferenceImage(data.visualReference);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      if (target === "start") {
        setStartFrame(null);
        setStartPreview(null);
      } else {
        setReferenceImage(null);
        setReferencePreview(null);
      }
    } finally {
      if (target === "start") setUploadingStart(false);
      else setUploadingRef(false);
    }
  }

  async function enhance() {
    if (!prompt.trim()) return;
    setEnhancing(true);
    setError(null);
    try {
      const res = await fetch("/api/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Enhance failed");
      setPrompt(data.enhanced);
      setMessage("Prompt enhanced with cinematic detail.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enhance failed");
    } finally {
      setEnhancing(false);
    }
  }

  async function generate() {
    if (!user) {
      setError("Sign in to generate with your private credit wallet.");
      return;
    }
    if (!prompt.trim()) {
      setError("Write a prompt before generating.");
      return;
    }
    if (mode === "image-to-video" && !startFrame) {
      setError("Upload a Start Frame for Image to Video.");
      return;
    }
    if (mode === "inpaint" && !referenceImage && !startFrame) {
      setError("Upload a reference image for Inpaint / Edit.");
      return;
    }
    if (user.credits < credits) {
      setError(`Not enough credits. Need ${credits}.`);
      openPricing();
      return;
    }

    setGenerating(true);
    setError(null);
    setMessage("Generating with OpenArt MCP…");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          prompt,
          negativePrompt: showNegative ? negativePrompt : undefined,
          stylePreset,
          aspectRatio,
          duration,
          quality,
          startFrame,
          referenceImage,
          isPublic,
          waitForResult: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      onGenerated?.(data.generation);
      setMessage(data.message || "Generation saved to your library.");
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      await refreshUser();
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="animate-fade-up overflow-hidden rounded-[28px] border border-[var(--border)] bg-[rgba(12,18,30,0.72)] shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <div className="border-b border-white/8 p-2 sm:p-3">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-black/25 p-1 lg:grid-cols-4">
          {TABS.map((tab) => {
            const active = mode === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMode(tab.id)}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium transition ${
                  active
                    ? "bg-[#152033] text-white shadow-[inset_0_0_0_1px_rgba(34,211,238,0.28)]"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-cyan-300" : ""}`} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="text-sm font-medium text-white/80">Prompt</label>
            <button
              type="button"
              onClick={() => void enhance()}
              disabled={!prompt.trim() || enhancing}
              className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-100 disabled:opacity-40"
            >
              {enhancing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <WandSparkles className="h-3.5 w-3.5" />
              )}
              AI Enhance Prompt
            </button>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            placeholder="Describe your vision in detail…"
            className="w-full resize-y rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[15px] leading-relaxed text-white outline-none placeholder:text-white/30 focus:border-cyan-400/40 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.12)]"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowNegative((v) => !v)}
              className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-white"
            >
              {showNegative ? "Hide" : "Show"} Negative Prompt
            </button>
            <label className="inline-flex items-center gap-2 text-xs text-white/50">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="accent-cyan-400"
              />
              Share to Community Feed
            </label>
          </div>
          {showNegative && (
            <textarea
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              rows={2}
              placeholder="Negative prompt: blurry, watermark, low quality…"
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/40"
            />
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-white/80">Style Preset</span>
            <select
              value={stylePreset}
              onChange={(e) => setStylePreset(e.target.value as StylePreset)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-cyan-400/40"
            >
              {STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-2">
            <span className="text-sm font-medium text-white/80">Aspect Ratio</span>
            <div className="grid grid-cols-2 gap-2">
              {ASPECTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAspectRatio(a.id)}
                  className={`rounded-xl border px-3 py-2.5 text-xs transition ${
                    aspectRatio === a.id
                      ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-100"
                      : "border-white/10 bg-black/20 text-white/55 hover:text-white"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {(mode === "image-to-video" || mode === "inpaint" || mode === "text-to-image" || mode === "text-to-video") && (
          <div className={`grid gap-4 ${mode === "image-to-video" ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
            {mode === "image-to-video" && (
              <ImageDropzone
                label="Start Frame"
                hint="Required · first frame of the video"
                value={startFrame}
                previewUrl={startPreview}
                uploading={uploadingStart}
                onUpload={(file) => upload(file, "start")}
                onClear={() => {
                  setStartFrame(null);
                  setStartPreview(null);
                }}
              />
            )}
            <ImageDropzone
              label={mode === "inpaint" ? "Image to Edit" : "Reference Image"}
              hint={mode === "inpaint" ? "Required for inpaint / edit" : "Optional style / subject reference"}
              value={referenceImage}
              previewUrl={referencePreview}
              uploading={uploadingRef}
              onUpload={(file) => upload(file, "reference")}
              onClear={() => {
                setReferenceImage(null);
                setReferencePreview(null);
              }}
            />
          </div>
        )}

        {isVideo && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-white/80">Motion / Duration</span>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value) as VideoDuration)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-cyan-400/40"
              >
                <option value={5}>5 seconds</option>
                <option value={10}>10 seconds</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-white/80">Resolution</span>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as VideoQuality)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-cyan-400/40"
              >
                <option value="standard">720p</option>
                <option value="pro">1080p Pro</option>
              </select>
            </label>
          </div>
        )}

        <button
          type="button"
          onClick={() => void generate()}
          disabled={generating}
          className="animate-pulse-glow group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-400 to-cyan-300 px-5 py-4 text-base font-semibold text-[#041018] disabled:opacity-60"
        >
          <span className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.4),transparent)] transition duration-700 group-hover:translate-x-full" />
          <span className="relative z-10 flex items-center justify-center gap-2">
            {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5 fill-current" />}
            {generating
              ? "Generating…"
              : `Generate ${isVideo ? "Video" : "Image"} (-${credits} Credits)`}
          </span>
        </button>

        {(error || message) && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              error
                ? "border-rose-400/30 bg-rose-400/10 text-rose-100"
                : "border-cyan-400/25 bg-cyan-400/10 text-cyan-100"
            }`}
          >
            {error ?? message}
          </div>
        )}
      </div>
    </section>
  );
}
