"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  ChevronDown,
  ImagePlus,
  Loader2,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import type { CatalogModel } from "@/lib/model-catalog";
import type { VisualReference } from "@/lib/types";
import { fetchJson } from "@/lib/fetch-json";
import { ModelsModal } from "./ModelsModal";
import type { CustomerUser } from "./AppHeader";

const ASPECTS = ["9:16", "16:9", "1:1", "4:3", "3:4"] as const;
const RESOLUTIONS = ["360p", "480p", "720p", "1080p", "1K"] as const;
const DURATIONS = [4, 5, 6, 8, 10, 12, 15] as const;

interface CreateStudioProps {
  user: CustomerUser | null;
  onUserRefresh: () => Promise<void>;
}

export function CreateStudio({ user, onUserRefresh }: CreateStudioProps) {
  const router = useRouter();
  const [media, setMedia] = useState<"image" | "video">("image");
  const [imageModels, setImageModels] = useState<CatalogModel[]>([]);
  const [videoModels, setVideoModels] = useState<CatalogModel[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(["nano-banana-2-lite"]);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<string>("1:1");
  const [resolution, setResolution] = useState<string>("720p");
  const [duration, setDuration] = useState<number>(5);
  const [generateAudio, setGenerateAudio] = useState(false);
  const [refs, setRefs] = useState<VisualReference[]>([]);
  const [refPreviews, setRefPreviews] = useState<string[]>([]);
  const [startFrame, setStartFrame] = useState<VisualReference | null>(null);
  const [endFrame, setEndFrame] = useState<VisualReference | null>(null);
  const [startPreview, setStartPreview] = useState<string | null>(null);
  const [endPreview, setEndPreview] = useState<string | null>(null);
  const [creditCost, setCreditCost] = useState(15);
  const [quoting, setQuoting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await fetchJson<{ image: CatalogModel[]; video: CatalogModel[] }>(
        "/api/models",
      );
      setImageModels(data.image);
      setVideoModels(data.video);
    })();
  }, []);

  useEffect(() => {
    if (media === "image") {
      setSelectedIds((prev) => {
        const keep = prev.filter((id) => imageModels.some((m) => m.id === id));
        return keep.length ? keep : ["nano-banana-2-lite"];
      });
      setAspectRatio("1:1");
    } else {
      setSelectedIds((prev) => {
        const keep = prev.filter((id) => videoModels.some((m) => m.id === id));
        return keep.length ? keep : ["pixverse-v6"];
      });
      setAspectRatio("16:9");
    }
  }, [media, imageModels, videoModels]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!selectedIds.length) return;
      setQuoting(true);
      try {
        const mode =
          media === "image"
            ? refs.length
              ? "image2image"
              : "text2image"
            : startFrame
              ? "image2video"
              : "text2video";
        const { data } = await fetchJson<{ totalCredits: number }>("/api/credits/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelIds: selectedIds,
            media,
            mode,
            aspectRatio,
            resolution: media === "video" ? resolution : undefined,
            duration: media === "video" ? duration : undefined,
            generateAudio: media === "video" ? generateAudio : undefined,
          }),
        });
        if (!cancelled) setCreditCost(data.totalCredits);
      } catch {
        if (!cancelled) setCreditCost(media === "image" ? 15 * selectedIds.length : 70);
      } finally {
        if (!cancelled) setQuoting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedIds, media, aspectRatio, resolution, duration, generateAudio, refs.length, startFrame]);

  const selectedLabels = useMemo(() => {
    const all = [...imageModels, ...videoModels];
    return selectedIds.map((id) => all.find((m) => m.id === id)?.name || id);
  }, [selectedIds, imageModels, videoModels]);

  async function uploadFile(file: File, purpose: "create-image" | "create-video") {
    const form = new FormData();
    form.append("file", file);
    form.append("purpose", purpose);
    form.append("label", file.name || "reference");
    const { res, data } = await fetchJson<{
      error?: string;
      visualReference?: VisualReference;
    }>("/api/upload", { method: "POST", body: form });
    if (!res.ok) throw new Error(data.error || "Upload failed");
    return data.visualReference as VisualReference;
  }

  async function handleAddRefs(files: FileList | null) {
    if (!files?.length) return;
    try {
      const nextRefs = [...refs];
      const nextPreviews = [...refPreviews];
      for (const file of Array.from(files).slice(0, 4 - nextRefs.length)) {
        const preview = URL.createObjectURL(file);
        const ref = await uploadFile(file, media === "image" ? "create-image" : "create-video");
        nextRefs.push(ref);
        nextPreviews.push(preview);
      }
      setRefs(nextRefs);
      setRefPreviews(nextPreviews);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function handleFrame(
    file: File | undefined,
    which: "start" | "end",
  ) {
    if (!file) return;
    try {
      const preview = URL.createObjectURL(file);
      const ref = await uploadFile(file, "create-video");
      if (which === "start") {
        setStartFrame(ref);
        setStartPreview(preview);
      } else {
        setEndFrame(ref);
        setEndPreview(preview);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function handleEnhance() {
    if (!prompt.trim()) return;
    try {
      const { res, data } = await fetchJson<{ enhanced?: string; error?: string }>(
        "/api/enhance",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            mode: media === "image" ? "text-to-image" : "text-to-video",
          }),
        },
      );
      if (!res.ok) throw new Error(data.error || "Enhance failed");
      setPrompt(data.enhanced || prompt);
      setStatus("Prompt polished");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enhance failed");
    }
  }

  async function handleGenerate() {
    setError(null);
    setStatus(null);

    if (!user) {
      router.push(`/login?next=${encodeURIComponent("/")}&paywall=1`);
      return;
    }
    if (!prompt.trim()) {
      setError("Write a prompt first.");
      return;
    }
    if (user.credits < creditCost) {
      router.push("/pricing?paywall=1");
      return;
    }

    setGenerating(true);
    setStatus("Generating via OpenArt MCP…");
    try {
      const mode =
        media === "image"
          ? refs.length
            ? "image2image"
            : "text2image"
          : startFrame
            ? "image2video"
            : "text2video";

      const { res, data } = await fetchJson<{
        error?: string;
        needsAuth?: boolean;
        needsPaywall?: boolean;
        creditsRemaining?: number;
        results?: Array<{ error?: string; status?: string; urls?: string[] }>;
      }>("/api/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          modelIds: selectedIds,
          media,
          mode,
          prompt: prompt.trim(),
          aspectRatio,
          resolution: media === "video" ? resolution : undefined,
          duration: media === "video" ? duration : undefined,
          generateAudio: media === "video" ? generateAudio : undefined,
          startFrame,
          endFrame,
          referenceImages: refs,
          waitForResult: false,
        }),
      });

      if (res.status === 401 || data.needsAuth) {
        router.push(`/login?next=${encodeURIComponent("/")}&paywall=1`);
        return;
      }
      if (res.status === 402 || data.needsPaywall) {
        router.push("/pricing?paywall=1");
        return;
      }
      if (!res.ok) throw new Error(data.error || "Generation failed");

      const failed = data.results?.find((r) => r.error);
      if (failed?.error) setError(failed.error);
      else setStatus("Queued — open Assets to view results.");

      await onUserRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div id="create" className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-28 pt-4 sm:px-6">
      {(error || status) && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            error
              ? "border-rose-400/30 bg-rose-400/10 text-rose-100"
              : "border-cyan-400/25 bg-cyan-400/10 text-cyan-50"
          }`}
        >
          {error ?? status}
        </div>
      )}

      <div className="flex gap-2">
        {(["image", "video"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setMedia(item)}
            className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${
              media === item ? "bg-white text-black" : "border border-white/10 text-white/70"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setModelsOpen(true)}
        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-[#141821] px-4 py-3 text-left"
      >
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-white/40">Models</p>
          <p className="mt-1 text-sm text-white">
            {selectedLabels.slice(0, 2).join(", ")}
            {selectedLabels.length > 2 ? ` +${selectedLabels.length - 2}` : ""}
          </p>
          <p className="text-xs text-white/45">Select Multiple Up to 4</p>
        </div>
        <ChevronDown className="h-4 w-4 text-white/50" />
      </button>

      <div className="rounded-2xl border border-dashed border-white/15 bg-[#141821] p-4">
        <p className="mb-2 text-sm font-medium text-white/80">Add visual references</p>
        <div className="flex flex-wrap gap-2">
          {refPreviews.map((src, i) => (
            <div key={src} className="relative h-16 w-16 overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                className="absolute right-1 top-1 rounded-full bg-black/70 p-0.5"
                onClick={() => {
                  setRefs((r) => r.filter((_, idx) => idx !== i));
                  setRefPreviews((r) => r.filter((_, idx) => idx !== i));
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {refs.length < 4 && (
            <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-xl border border-white/15 text-white/60">
              <ImagePlus className="h-5 w-5" />
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => void handleAddRefs(e.target.files)}
              />
            </label>
          )}
        </div>
      </div>

      {media === "video" && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Start Frame", preview: startPreview, which: "start" as const },
            { label: "End Frame", preview: endPreview, which: "end" as const },
          ].map((slot) => (
            <label
              key={slot.label}
              className="flex min-h-[110px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-[#141821] p-3 text-center"
            >
              {slot.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={slot.preview} alt="" className="mb-2 h-16 w-full rounded-lg object-cover" />
              ) : (
                <ImagePlus className="mb-2 h-5 w-5 text-white/50" />
              )}
              <span className="text-xs text-white/70">{slot.label}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handleFrame(e.target.files?.[0], slot.which)}
              />
            </label>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-[#141821] p-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={5}
          placeholder={
            media === "image"
              ? "Describe the image you want to create…"
              : "Describe the video scene, motion, and mood…"
          }
          className="w-full resize-y bg-transparent text-[15px] text-white outline-none placeholder:text-white/35"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70"
          >
            <Camera className="h-3.5 w-3.5" />
            Camera
          </button>
          <button
            type="button"
            onClick={() => void handleEnhance()}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70"
          >
            <WandSparkles className="h-3.5 w-3.5 text-[#22f0ff]" />
            Auto Polish
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#141821] p-4">
        <p className="mb-3 text-sm font-semibold text-white">Output</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-xs text-white/50">
            Aspect
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            >
              {ASPECTS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          {media === "video" && (
            <>
              <label className="space-y-1 text-xs text-white/50">
                Resolution
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                >
                  {RESOLUTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs text-white/50">
                Duration
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                >
                  {DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}s
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>
        {media === "video" && (
          <label className="mt-3 flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={generateAudio}
              onChange={(e) => setGenerateAudio(e.target.checked)}
            />
            Generate audio
          </label>
        )}
      </div>

      <button
        type="button"
        onClick={() => void handleGenerate()}
        disabled={generating}
        className="relative z-20 flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-5 py-4 text-base font-bold text-white disabled:opacity-70"
      >
        {generating || quoting ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Sparkles className="h-5 w-5" />
        )}
        {generating ? "Generating…" : "Generate"}
        <span className="rounded-full bg-black/20 px-2 py-0.5 text-xs">−{creditCost}</span>
      </button>

      <ModelsModal
        open={modelsOpen}
        kind={media}
        imageModels={imageModels}
        videoModels={videoModels}
        selectedIds={selectedIds}
        onClose={() => setModelsOpen(false)}
        onChange={setSelectedIds}
      />
    </div>
  );
}
