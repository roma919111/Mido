"use client";

import { useEffect, useMemo, useState } from "react";
import { estimateGenerationCredits, VIDEO_MODEL } from "@/lib/models";
import type {
  AccountInfo,
  GalleryItem,
  GenerationMode,
  GenerateResponse,
  VideoDuration,
  VideoResolution,
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
const MCP_ENDPOINT = "https://mcp.openart.ai/mcp";

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

function formatLivePayload(payload: unknown): string {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

export function StudioApp() {
  const [mode, setMode] = useState<GenerationMode>("text-to-image");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState<VideoDuration>(5);
  const [resolution, setResolution] = useState<VideoResolution>("720p");
  const [generateAudio, setGenerateAudio] = useState(false);
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
  const [liveMcpResponse, setLiveMcpResponse] = useState<string | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [account, setAccount] = useState<AccountInfo>({
    credits: 0,
    configured: false,
    live: false,
    needsAuth: false,
    mcpEndpoint: MCP_ENDPOINT,
  });

  useEffect(() => {
    setGallery(loadGallery());
  }, []);

  useEffect(() => {
    window.localStorage.setItem(GALLERY_KEY, JSON.stringify(gallery.slice(0, 24)));
  }, [gallery]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("authError");
    const ownerConnected = params.get("ownerConnected");
    if (authError) {
      setError(authError);
      setStatusMessage(null);
    } else if (ownerConnected) {
      setStatusMessage("Platform OpenArt account connected. Customers can generate with no login.");
      setError(null);
    }
    if (authError || ownerConnected) {
      const url = new URL(window.location.href);
      url.searchParams.delete("authError");
      url.searchParams.delete("ownerConnected");
      window.history.replaceState({}, "", url.pathname + url.search);
    }

    let cancelled = false;
    void (async () => {
      if (!cancelled) await refreshAccount();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const creditCost = useMemo(
    () =>
      estimateGenerationCredits({
        mode,
        model: VIDEO_MODEL,
        resolution,
        hasAudio: generateAudio,
        durationInSeconds: duration,
      }),
    [mode, duration, resolution, generateAudio],
  );

  const isVideoMode = mode !== "text-to-image";

  async function refreshAccount() {
    try {
      const res = await fetch("/api/account");
      const data = (await res.json()) as AccountInfo & {
        error?: string;
        details?: unknown;
        raw?: unknown;
        mcpEndpoint?: string;
        live?: boolean;
      };

      setLiveMcpResponse(
        formatLivePayload({
          route: "GET /api/account → openart_account_get (owner platform account)",
          httpStatus: res.status,
          mcpEndpoint: data.mcpEndpoint ?? MCP_ENDPOINT,
          billing: "owner_account",
          body: data,
        }),
      );

      if (!res.ok) {
        setAccount({
          credits: 0,
          configured: false,
          live: Boolean(data.live),
          needsAuth: false,
          mcpEndpoint: data.mcpEndpoint ?? MCP_ENDPOINT,
          plan: undefined,
          email: undefined,
          error: data.error,
        });
        setError(data.error || "Studio backend is not connected to OpenArt yet");
        return;
      }

      setAccount({
        credits: typeof data.credits === "number" ? data.credits : 0,
        configured: Boolean(data.configured),
        live: data.live !== false,
        needsAuth: false,
        mcpEndpoint: data.mcpEndpoint ?? MCP_ENDPOINT,
        plan: data.plan,
        email: data.email,
      });
      setError(null);
      setStatusMessage("Studio ready — generate with no login. Billed to the platform OpenArt account.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Account lookup failed";
      setAccount({
        credits: 0,
        configured: false,
        live: false,
        needsAuth: false,
        mcpEndpoint: MCP_ENDPOINT,
        error: message,
      });
      setError(message);
      setLiveMcpResponse(
        formatLivePayload({
          route: "GET /api/account → openart_account_get (owner platform account)",
          error: message,
          mcpEndpoint: MCP_ENDPOINT,
        }),
      );
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
      const form = new FormData();
      form.append("file", file);
      form.append("purpose", purpose);
      form.append("label", file.name || (target === "start" ? "start-frame" : "reference"));

      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();

      setLiveMcpResponse(
        formatLivePayload({
          route: "POST /api/upload → openart_upload_sign",
          httpStatus: res.status,
          mcpEndpoint: data.mcpEndpoint ?? MCP_ENDPOINT,
          body: data,
        }),
      );

      if (!res.ok) throw new Error(data.error || "Upload failed");

      const ref = data.visualReference as VisualReference;
      if (target === "start") setStartFrame(ref);
      else setReferenceImage(ref);
      setStatusMessage("Uploaded to OpenArt MCP.");
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
    const currentPrompt = prompt.trim();
    if (!currentPrompt) {
      setError("Write a prompt before generating.");
      setStatusMessage(null);
      return;
    }
    if (mode === "image-to-video" && !startFrame) {
      setError("Upload a Start Frame for Image-to-Video.");
      setStatusMessage(null);
      return;
    }

    setGenerating(true);
    setError(null);
    setStatusMessage(`Calling live OpenArt MCP at ${MCP_ENDPOINT}…`);

    const optimisticId = `local_${Date.now()}`;
    const optimistic: GalleryItem = {
      id: optimisticId,
      historyId: optimisticId,
      mediaType: isVideoMode ? "video" : "image",
      url: "",
      prompt: currentPrompt,
      mode,
      createdAt: new Date().toISOString(),
      status: "running",
      creditsUsed: creditCost,
    };
    setGallery((prev) => [optimistic, ...prev]);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          prompt: currentPrompt,
          duration,
          resolution,
          generateAudio,
          startFrame,
          referenceImage,
          waitForResult: true,
        }),
      });
      const data = (await res.json()) as GenerateResponse & {
        error?: string;
        details?: unknown;
        raw?: unknown;
      };

      setLiveMcpResponse(
        formatLivePayload({
          route: `POST /api/generate → ${data.tool ?? (isVideoMode ? "openart_generate_video" : "openart_generate_image")}`,
          httpStatus: res.status,
          mcpEndpoint: data.mcpEndpoint ?? MCP_ENDPOINT,
          live: data.live,
          body: data,
        }),
      );

      if (!res.ok) {
        const insufficient =
          res.status === 402 ||
          data.error === "Insufficient credit balance";
        throw new Error(
          insufficient
            ? `Insufficient credit balance (need ${data.requiredCredits ?? creditCost} credits).`
            : data.error || formatLivePayload(data),
        );
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

      if (status === "completed") {
        setStatusMessage("Live OpenArt MCP generation complete.");
      } else if (status === "failed") {
        setError(data.error || "Generation failed");
      } else {
        setStatusMessage("Still generating on OpenArt MCP — raw wait payload shown below.");
      }

      await refreshAccount();
    } catch (err) {
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
    <div className="relative min-h-screen overflow-x-hidden pb-28 sm:pb-0">
      <div className="pointer-events-none absolute inset-0 studio-backdrop" />
      <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-[rgba(46,230,166,0.12)] blur-3xl animate-float" />
      <div className="pointer-events-none absolute -right-16 top-48 h-80 w-80 rounded-full bg-[rgba(255,176,92,0.1)] blur-3xl animate-float-delayed" />

      <Header
        plan={account.plan}
        configured={account.configured}
        live={account.live}
        connectionError={account.error}
      />

      {(error || statusMessage) && (
        <div className="relative z-40 mx-auto w-full max-w-6xl px-4 pt-3 sm:px-6">
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              error
                ? "border-rose-400/30 bg-rose-400/10 text-rose-100"
                : "border-cyan-400/25 bg-[rgba(34,240,255,0.08)] text-cyan-100"
            }`}
          >
            {error ?? statusMessage}
          </div>
        </div>
      )}

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-28 pt-8 sm:px-6">
        <section className="animate-fade-up mb-8 max-w-3xl">
          <p className="mb-3 text-xs uppercase tracking-[0.24em] text-[var(--accent)]/80">
            Creative workbench
          </p>
          <h1 className="leading-[1.05]">
            <BrandLogo size="lg" />
          </h1>
          <p className="mt-3 max-w-xl text-base text-white/55 sm:text-lg">
            Generate images and videos instantly — no account, no token, no login. OpenArt MCP runs
            behind the scenes on the platform account.
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
                resolution={resolution}
                generateAudio={generateAudio}
                estimatedCredits={creditCost}
                onDurationChange={setDuration}
                onResolutionChange={setResolution}
                onGenerateAudioChange={setGenerateAudio}
              />
            )}

            {liveMcpResponse && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/80">
                    Live OpenArt MCP response
                  </p>
                  <p className="text-[10px] text-white/35">{MCP_ENDPOINT}</p>
                </div>
                <pre className="max-h-80 overflow-auto rounded-2xl border border-white/10 bg-black/40 p-4 text-xs leading-relaxed text-white/75">
                  {liveMcpResponse}
                </pre>
              </div>
            )}
          </div>
        </section>

        <div className="mt-12 animate-fade-up animation-delay-2">
          <MediaGallery items={gallery} />
        </div>
      </main>

      <Footer />

      {/* Keep outside backdrop-blur sections so fixed positioning works on mobile. */}
      <GenerateButton
        label={isVideoMode ? "Generate Video" : "Generate Image"}
        credits={creditCost}
        loading={generating}
        hint={
          !prompt.trim()
            ? "Tip: type your prompt above, then tap Generate."
            : mode === "image-to-video" && !startFrame
              ? "Tip: upload a Start Frame for Image-to-Video."
              : "Ready — tap Generate anytime."
        }
        onClick={() => {
          void handleGenerate();
        }}
      />
    </div>
  );
}
