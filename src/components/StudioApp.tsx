"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_DEMO_CREDITS, estimateCredits } from "@/lib/models";
import type {
  AccountInfo,
  GalleryItem,
  GenerationMode,
  GenerateResponse,
  VideoDuration,
  VideoQuality,
  VisualReference,
} from "@/lib/types";
import { BrandLogo } from "./BrandLogo";
import { Footer } from "./Footer";
import { GenerateButton } from "./GenerateButton";
import { Header } from "./Header";
import { ImageDropzone } from "./ImageDropzone";
import { MediaGallery } from "./MediaGallery";
import { ModeSwitcher } from "./ModeSwitcher";
import { PromptInput } from "./PromptInput";
import { VideoControls } from "./VideoControls";

const GALLERY_KEY = "studio-ai-gallery-v1";
const CREDITS_KEY = "studio-ai-demo-credits-v1";

function loadGallery(): GalleryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GALLERY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GalleryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadDemoCredits(): number {
  if (typeof window === "undefined") return DEFAULT_DEMO_CREDITS;
  try {
    const raw = window.localStorage.getItem(CREDITS_KEY);
    if (raw == null) return DEFAULT_DEMO_CREDITS;
    const value = Number(raw);
    return Number.isFinite(value) ? Math.max(0, value) : DEFAULT_DEMO_CREDITS;
  } catch {
    return DEFAULT_DEMO_CREDITS;
  }
}

function saveDemoCredits(credits: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CREDITS_KEY, String(Math.max(0, credits)));
}

export function StudioApp() {
  const [mode, setMode] = useState<GenerationMode>("text-to-image");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState<VideoDuration>(5);
  const [quality, setQuality] = useState<VideoQuality>("standard");
  const [startFrame, setStartFrame] = useState<VisualReference | null>(null);
  const [startPreview, setStartPreview] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<VisualReference | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [uploadingStart, setUploadingStart] = useState(false);
  const [uploadingReference, setUploadingReference] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [account, setAccount] = useState<AccountInfo>({
    credits: DEFAULT_DEMO_CREDITS,
    configured: false,
    plan: "Demo",
  });

  useEffect(() => {
    setGallery(loadGallery());
    setAccount((prev) => ({ ...prev, credits: loadDemoCredits() }));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(GALLERY_KEY, JSON.stringify(gallery.slice(0, 24)));
  }, [gallery]);

  useEffect(() => {
    if (!account.configured) {
      saveDemoCredits(account.credits);
    }
  }, [account.credits, account.configured]);

  useEffect(() => {
    void refreshAccount();
  }, []);

  // Poll OpenArt for any in-progress gallery items.
  useEffect(() => {
    const pending = gallery.filter(
      (item) =>
        (item.status === "pending" || item.status === "running") &&
        item.historyId &&
        !item.historyId.startsWith("demo_") &&
        !item.historyId.startsWith("local_"),
    );

    if (pending.length === 0) return;

    let cancelled = false;

    const poll = async () => {
      for (const item of pending) {
        try {
          const res = await fetch(`/api/status?historyId=${encodeURIComponent(item.historyId)}`);
          if (!res.ok || cancelled) continue;
          const data = await res.json();
          const status = String(data.status ?? "").toUpperCase();
          const url = (data.urls as string[] | undefined)?.[0] ?? "";

          if (status === "COMPLETED" || url) {
            setGallery((prev) =>
              prev.map((row) =>
                row.historyId === item.historyId
                  ? { ...row, status: "completed", url: url || row.url }
                  : row,
              ),
            );
          } else if (status === "FAILED" || status === "CANCELLED") {
            setGallery((prev) =>
              prev.map((row) =>
                row.historyId === item.historyId
                  ? {
                      ...row,
                      status: status === "CANCELLED" ? "cancelled" : "failed",
                      error: data.error || "Generation failed",
                    }
                  : row,
              ),
            );
          }
        } catch {
          // keep polling
        }
      }
    };

    void poll();
    const id = window.setInterval(() => void poll(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [gallery]);

  const pricing = account.configured ? "openart" : "demo";

  const creditCost = useMemo(
    () => estimateCredits(mode, duration, quality, pricing),
    [mode, duration, quality, pricing],
  );

  const isVideoMode = mode !== "text-to-image";

  async function refreshAccount() {
    try {
      const res = await fetch("/api/account");
      const data = (await res.json()) as AccountInfo & { error?: string; message?: string };
      if (!res.ok) {
        setAccount((prev) => ({
          ...prev,
          configured: false,
          credits: loadDemoCredits(),
          plan: "Demo",
        }));
        return;
      }

      if (data.configured) {
        setAccount({
          credits: typeof data.credits === "number" ? data.credits : 0,
          configured: true,
          plan: data.plan,
          email: data.email,
        });
      } else {
        setAccount((prev) => ({
          ...prev,
          credits: loadDemoCredits(),
          configured: false,
          plan: "Demo",
          email: undefined,
        }));
      }

      if (data.message) setStatusMessage(data.message);
    } catch {
      // keep demo credits
    }
  }

  async function uploadImage(
    file: File,
    purpose: "create-image" | "create-video",
    target: "start" | "reference",
  ) {
    setError(null);
    const localUrl = URL.createObjectURL(file);
    if (target === "start") {
      setUploadingStart(true);
      setStartPreview(localUrl);
    } else {
      setUploadingReference(true);
      setReferencePreview(localUrl);
    }

    try {
      if (!account.configured) {
        const demoRef: VisualReference = {
          type: "image",
          id: `local_${Date.now()}`,
          url: localUrl,
          label: file.name || "local-image",
        };
        if (target === "start") setStartFrame(demoRef);
        else setReferenceImage(demoRef);
        setStatusMessage("Demo upload stored locally. Connect OpenArt to upload to the cloud.");
        return;
      }

      const form = new FormData();
      form.append("file", file);
      form.append("purpose", purpose);
      form.append("label", file.name || (target === "start" ? "start-frame" : "reference"));

      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      const ref = data.visualReference as VisualReference;
      if (target === "start") setStartFrame(ref);
      else setReferenceImage(ref);
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
      else setUploadingReference(false);
    }
  }

  async function handleEnhance() {
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
      setPrompt(data.enhanced as string);
      setStatusMessage("Prompt enhanced for stronger composition and lighting.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enhance failed");
    } finally {
      setEnhancing(false);
    }
  }

  async function handleGenerate() {
    if (!prompt.trim()) {
      setError("Write a prompt before generating.");
      return;
    }
    if (mode === "image-to-video" && !startFrame) {
      setError("Upload a Start Frame for Image-to-Video.");
      return;
    }
    if (account.credits < creditCost) {
      setError(`Not enough credits. This generation costs ${creditCost} credits.`);
      return;
    }

    setGenerating(true);
    setError(null);
    setStatusMessage(
      account.configured
        ? "Sending request to OpenArt MCP…"
        : "Running demo generation…",
    );

    const optimisticId = `local_${Date.now()}`;
    const optimistic: GalleryItem = {
      id: optimisticId,
      historyId: optimisticId,
      mediaType: isVideoMode ? "video" : "image",
      url: "",
      prompt,
      mode,
      createdAt: new Date().toISOString(),
      status: "running",
      creditsUsed: creditCost,
    };
    setGallery((prev) => [optimistic, ...prev]);
    setAccount((prev) => ({ ...prev, credits: Math.max(0, prev.credits - creditCost) }));

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          prompt,
          duration,
          quality,
          startFrame,
          referenceImage,
          waitForResult: true,
        }),
      });
      const data = (await res.json()) as GenerateResponse & {
        error?: string;
        message?: string;
        demo?: boolean;
      };

      if (!res.ok) {
        throw new Error(data.error || "Generation failed");
      }

      const url = data.urls?.[0] ?? "";
      const status =
        data.status?.toLowerCase() === "completed"
          ? "completed"
          : data.status?.toLowerCase() === "failed"
            ? "failed"
            : url
              ? "completed"
              : "running";

      setGallery((prev) =>
        prev.map((item) =>
          item.id === optimisticId
            ? {
                ...item,
                id: data.historyId || item.id,
                historyId: data.historyId || item.historyId,
                url,
                status,
                error: data.error,
              }
            : item,
        ),
      );

      if (data.message) setStatusMessage(data.message);
      else if (status === "completed") setStatusMessage("Generation complete.");
      else if (status === "failed") setError(data.error || "Generation failed");
      else setStatusMessage("Still generating on OpenArt — status will refresh automatically.");

      if (account.configured) {
        await refreshAccount();
      }
    } catch (err) {
      setAccount((prev) => ({ ...prev, credits: prev.credits + creditCost }));
      setGallery((prev) =>
        prev.map((item) =>
          item.id === optimisticId
            ? {
                ...item,
                status: "failed",
                error: err instanceof Error ? err.message : "Generation failed",
              }
            : item,
        ),
      );
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 studio-backdrop" />
      <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-[rgba(46,230,166,0.12)] blur-3xl animate-float" />
      <div className="pointer-events-none absolute -right-16 top-48 h-80 w-80 rounded-full bg-[rgba(255,176,92,0.1)] blur-3xl animate-float-delayed" />

      <Header
        credits={account.credits}
        plan={account.plan}
        configured={account.configured}
        email={account.email}
      />

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6">
        <section className="animate-fade-up mb-8 max-w-3xl">
          <p className="mb-3 text-xs uppercase tracking-[0.24em] text-[var(--neon-cyan)]/80">
            Next-gen creative workbench
          </p>
          <h1 className="leading-[1.05]">
            <BrandLogo size="xl" />
          </h1>
          <p className="mt-3 max-w-xl text-base text-white/55 sm:text-lg">
            Generate cinematic images and videos with OpenArt — from a single prompt to motion-ready
            frames.
          </p>
        </section>

        <section className="animate-fade-up animation-delay-1 rounded-[28px] border border-white/10 bg-[rgba(12,14,20,0.72)] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-6">
          <div className="space-y-5">
            <ModeSwitcher mode={mode} onChange={setMode} />

            <PromptInput
              value={prompt}
              onChange={setPrompt}
              onEnhance={() => void handleEnhance()}
              enhancing={enhancing}
              placeholder={
                mode === "text-to-image"
                  ? "Describe the image you want to create…"
                  : mode === "text-to-video"
                    ? "Describe the video scene, motion, and mood…"
                    : "Describe how the start frame should come alive…"
              }
            />

            <div
              className={`grid gap-4 ${
                mode === "image-to-video" ? "md:grid-cols-2" : "md:grid-cols-1"
              }`}
            >
              {mode === "image-to-video" && (
                <ImageDropzone
                  label="Start Frame"
                  hint="Required · becomes the first frame of the video"
                  value={startFrame}
                  previewUrl={startPreview}
                  uploading={uploadingStart}
                  onUpload={(file) => uploadImage(file, "create-video", "start")}
                  onClear={() => {
                    setStartFrame(null);
                    setStartPreview(null);
                  }}
                />
              )}

              <ImageDropzone
                label="Reference Image / Style"
                hint="Optional · guide style, subject, or look"
                value={referenceImage}
                previewUrl={referencePreview}
                uploading={uploadingReference}
                onUpload={(file) =>
                  uploadImage(file, isVideoMode ? "create-video" : "create-image", "reference")
                }
                onClear={() => {
                  setReferenceImage(null);
                  setReferencePreview(null);
                }}
              />
            </div>

            {isVideoMode && (
              <VideoControls
                duration={duration}
                quality={quality}
                onDurationChange={setDuration}
                onQualityChange={setQuality}
              />
            )}

            <GenerateButton
              label={isVideoMode ? "Generate Video" : "Generate Image"}
              credits={creditCost}
              loading={generating}
              disabled={!prompt.trim() || (mode === "image-to-video" && !startFrame)}
              onClick={() => void handleGenerate()}
            />

            {(error || statusMessage) && (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  error
                    ? "border-rose-400/30 bg-rose-400/10 text-rose-100"
                    : "border-[var(--accent)]/25 bg-[rgba(46,230,166,0.08)] text-[var(--accent)]"
                }`}
              >
                {error ?? statusMessage}
              </div>
            )}
          </div>
        </section>

        <div className="mt-12 animate-fade-up animation-delay-2">
          <MediaGallery items={gallery} />
        </div>
      </main>

      <Footer />
    </div>
  );
}
