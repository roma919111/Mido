"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  ChevronDown,
  Download,
  ImagePlus,
  Loader2,
  Share2,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import {
  durationBoundsForModel,
  formOptionsForModel,
  IMAGE_MODELS,
  resolutionLabel,
  VIDEO_MODELS,
  type CatalogModel,
} from "@/lib/model-catalog";
import {
  FREE_VERONIX_DURATION_SECONDS,
  FREE_VERONIX_RESOLUTION,
  VERONIX_MODEL_ID,
} from "@/lib/free-trial";
import type { VisualReference } from "@/lib/types";
import type { SceneState } from "@/lib/prompt-enhance";
import {
  MAX_SHOTS,
  MAX_TOTAL_SECONDS,
  PRODUCT_PER_SHOT_SECONDS,
} from "@/lib/shot-plan";
import { fetchJson } from "@/lib/fetch-json";
import { veronixDownloadPath, veronixMediaSrc } from "@/lib/media-proxy";
import type { CustomerUser } from "./AppHeader";

/** Poll long enough for slow Seedance/OpenArt jobs (~15 min). */
const PREVIEW_POLL_ATTEMPTS = 180;
const PREVIEW_POLL_MS = 5000;

const IMAGE_ASPECTS = ["1:1", "16:9", "9:16", "4:3", "3:4"] as const;
const VIDEO_ASPECT = "16:9";

interface CreateStudioProps {
  user: CustomerUser | null;
  onUserRefresh: () => Promise<void>;
  /** Lock studio to one media type (dedicated create pages). */
  lockedMedia?: "image" | "video";
}

export function CreateStudio({ user, onUserRefresh, lockedMedia }: CreateStudioProps) {
  const router = useRouter();
  const [media, setMedia] = useState<"image" | "video">(lockedMedia || "video");
  const [imageModels, setImageModels] = useState<CatalogModel[]>(IMAGE_MODELS);
  const [videoModels, setVideoModels] = useState<CatalogModel[]>(VIDEO_MODELS);
  const [selectedModelId, setSelectedModelId] = useState(VERONIX_MODEL_ID);
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");
  const [resolution, setResolution] = useState<string>(FREE_VERONIX_RESOLUTION);
  const [duration, setDuration] = useState<number>(FREE_VERONIX_DURATION_SECONDS);
  const [generateAudio, setGenerateAudio] = useState(false);
  const [freeTrial, setFreeTrial] = useState(false);
  const [refs, setRefs] = useState<VisualReference[]>([]);
  const [refPreviews, setRefPreviews] = useState<string[]>([]);
  const [startFrame, setStartFrame] = useState<VisualReference | null>(null);
  const [endFrame, setEndFrame] = useState<VisualReference | null>(null);
  const [startPreview, setStartPreview] = useState<string | null>(null);
  const [endPreview, setEndPreview] = useState<string | null>(null);
  const [creditCost, setCreditCost] = useState<number | null>(null);
  const [creditLive, setCreditLive] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [platformReady, setPlatformReady] = useState<boolean | null>(null);
  const [preview, setPreview] = useState<{
    url: string;
    mediaType: "image" | "video";
    historyId?: string;
    status: "running" | "completed" | "failed";
    freeTrial?: boolean;
  } | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [genStartedAt, setGenStartedAt] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  /** Final pose / entities from last enhance — used for sequential actions (ثم…). */
  const [promptSceneState, setPromptSceneState] = useState<SceneState | null>(null);
  const [enhancing, setEnhancing] = useState(false);
  /** Auto-split ANY sequential ثم/then prompt into chained clips (paid video only). */
  const [multiShotOn, setMultiShotOn] = useState(true);
  const [shotHint, setShotHint] = useState<{
    count: number;
    totalCredits: number | null;
    actions: string[];
    preferredPerShot: number;
    preferredTotalSeconds: number;
    perShotSeconds: number;
    /** OpenArt render length (may be model min > 2); final trim uses perShotSeconds. */
    apiPerShotSeconds: number;
    totalSeconds: number;
    labelAr: string;
  } | null>(null);
  /** Structured shots from enhance / plan — used at generate (context split, no ثم required). */
  const [plannedShots, setPlannedShots] = useState<
    Array<{ prompt: string; action: string }> | null
  >(null);
  const waitingResult = generating || preview?.status === "running";
  // Lock free-trial defaults only when the customer has no credits yet.
  // Users with a balance can run paid multi-shot (4s×N) without burning the
  // single free clip first — otherwise they only ever see one 4s video.
  const freeSettingsLocked =
    media === "video" &&
    selectedModelId === VERONIX_MODEL_ID &&
    !user?.freeVeronixUsed &&
    (user?.credits ?? 0) <= 0;

  const allModels = useMemo(
    () => [...imageModels, ...videoModels],
    [imageModels, videoModels],
  );
  const selectedModel = allModels.find((m) => m.id === selectedModelId) ?? null;
  const durationBounds = durationBoundsForModel(selectedModel);
  const formOptions = formOptionsForModel(selectedModel);
  const resolutionOptions = formOptions.resolutions;
  /** Multi-shot: slider = final stitched length (up to 30s). Single: model bounds. */
  const multiDurationMode = Boolean(
    media === "video" && multiShotOn && !freeTrial && !freeSettingsLocked,
  );
  const sliderMin = multiDurationMode ? PRODUCT_PER_SHOT_SECONDS : durationBounds.min;
  const sliderMax = multiDurationMode ? MAX_TOTAL_SECONDS : durationBounds.max;

  const applyVideoModelDefaults = (model: CatalogModel | null | undefined) => {
    setAspectRatio(VIDEO_ASPECT);
    if (!model) return;
    const options = formOptionsForModel(model);
    const freeLocked =
      model.id === VERONIX_MODEL_ID &&
      !user?.freeVeronixUsed &&
      (user?.credits ?? 0) <= 0;
    if (freeLocked) {
      setDuration(FREE_VERONIX_DURATION_SECONDS);
      setResolution(FREE_VERONIX_RESOLUTION);
      // Keep OpenArt audio for the free clip; stock intro also has sound.
      setGenerateAudio(true);
      return;
    }
    setDuration(options.duration.max);
    if (options.resolutions.length) {
      const nextRes =
        options.resolutionDefault ||
        options.resolutions[options.resolutions.length - 1] ||
        options.resolutions[0];
      setResolution(nextRes);
    }
    setGenerateAudio(options.audioSupported ? options.audioDefault : false);
  };

  useEffect(() => {
    if (lockedMedia) setMedia(lockedMedia);
  }, [lockedMedia]);

  // Free first visit: lock Veronix defaults to 4s model / 480p (+ stock intro).
  useEffect(() => {
    if (!freeSettingsLocked) return;
    setDuration(FREE_VERONIX_DURATION_SECONDS);
    setResolution(FREE_VERONIX_RESOLUTION);
    setAspectRatio(VIDEO_ASPECT);
  }, [freeSettingsLocked]);

  // Paid / post-trial: select model → duration max + synced resolution/audio defaults.
  useEffect(() => {
    if (media !== "video" || !selectedModel || freeSettingsLocked) return;
    applyVideoModelDefaults(selectedModel);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply when model identity changes
  }, [media, selectedModelId, freeSettingsLocked, selectedModel?.mcpId]);

  useEffect(() => {
    if (!waitingResult || genStartedAt == null) {
      if (!waitingResult) setElapsedSec(0);
      return;
    }
    const tick = () => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - genStartedAt) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [waitingResult, genStartedAt]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Fast path first so the picker never opens empty while sync runs.
      try {
        const { data } = await fetchJson<{
          image: CatalogModel[];
          video: CatalogModel[];
        }>("/api/models");
        if (cancelled) return;
        if (data.image?.length) setImageModels(data.image);
        if (data.video?.length) setVideoModels(data.video);
      } catch {
        // Keep static catalog already in state.
      }

      // Background refresh from OpenArt (duration/resolution/audio + costs).
      try {
        const { data } = await fetchJson<{
          image: CatalogModel[];
          video: CatalogModel[];
        }>("/api/models?sync=1");
        if (cancelled) return;
        if (data.image?.length) setImageModels(data.image);
        if (data.video?.length) setVideoModels(data.video);
      } catch {
        // Keep whatever we already have.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await fetchJson<{
          platformConnected?: boolean;
          needsOwnerSetup?: boolean;
        }>("/api/auth/session");
        setPlatformReady(Boolean(data.platformConnected) && !data.needsOwnerSetup);
      } catch {
        setPlatformReady(null);
      }
    })();
  }, []);

  useEffect(() => {
    if (media === "image") {
      const stillValid = imageModels.some((m) => m.id === selectedModelId && m.available);
      if (!stillValid) {
        const firstLive = imageModels.find((m) => m.available)?.id || "nano-banana-2-lite";
        setSelectedModelId(firstLive);
      }
      setAspectRatio("1:1");
    } else {
      const stillValid = videoModels.some((m) => m.id === selectedModelId && m.available);
      if (!stillValid) {
        const next =
          videoModels.find((m) => m.id === VERONIX_MODEL_ID && m.available) ||
          videoModels.find((m) => m.available) ||
          null;
        setSelectedModelId(next?.id || VERONIX_MODEL_ID);
        applyVideoModelDefaults(next);
      } else {
        setAspectRatio(VIDEO_ASPECT);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply defaults only on media/catalog identity changes
  }, [media, imageModels, videoModels, selectedModelId, user?.freeVeronixUsed]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!selectedModelId) return;
      setQuoting(true);
      setQuoteError(null);
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
          totalCredits: number;
          listPriceCredits?: number;
          freeTrial?: boolean;
          liveOpenArt?: boolean;
          synced?: boolean;
          source?: string;
          error?: string;
          quotes?: Array<{ available?: boolean; source?: string; totalCredits?: number }>;
        }>("/api/credits/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelIds: [selectedModelId],
            media,
            mode,
            aspectRatio: media === "video" ? VIDEO_ASPECT : aspectRatio,
            resolution: media === "video" ? resolution : undefined,
            duration: media === "video" ? duration : undefined,
            generateAudio: media === "video" ? generateAudio : undefined,
            // Multi-shot is paid — never mark as the free 4s trial when unlocked.
            multiShot:
              media === "video" &&
              multiShotOn &&
              (Boolean(user?.freeVeronixUsed) || (user?.credits ?? 0) > 0),
          }),
        });
        if (cancelled) return;
        if (!res.ok) {
          setCreditCost(null);
          setCreditLive(false);
          setFreeTrial(false);
          throw new Error(data.error || "تعذر جلب سعر الكريدت");
        }
        const isFree = Boolean(data.freeTrial);
        setFreeTrial(isFree);
        let nextCost = data.totalCredits;
        let nextHint: typeof shotHint = null;

        // General multi-shot estimate — context-aware (لا يشترط ثم).
        if (media === "video" && multiShotOn && !isFree && prompt.trim().length >= 12) {
          try {
            const planRes = await fetchJson<{
              autoMultiShot?: boolean;
              shotCount?: number;
              totalCredits?: number | null;
              actions?: string[];
              perShotSeconds?: number;
              totalSeconds?: number;
              timing?: {
                labelAr?: string;
                perShotSeconds?: number;
                totalSeconds?: number;
                preferredPerShot?: number;
                preferredTotalSeconds?: number;
                apiPerShotSeconds?: number;
              };
            }>("/api/shots/plan", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: prompt.trim(),
                modelId: selectedModelId,
                media,
                duration,
                resolution,
                generateAudio,
                aspectRatio: VIDEO_ASPECT,
                previousState: promptSceneState,
                multiShot: true,
              }),
            });
            if (
              !cancelled &&
              planRes.res.ok &&
              planRes.data.autoMultiShot &&
              (planRes.data.shotCount || 0) >= 2
            ) {
              const count = planRes.data.shotCount || 0;
              const preferredPerShot =
                planRes.data.timing?.preferredPerShot || PRODUCT_PER_SHOT_SECONDS;
              const preferredTotal =
                planRes.data.timing?.preferredTotalSeconds ||
                preferredPerShot * count;
              const per =
                planRes.data.timing?.perShotSeconds ||
                planRes.data.perShotSeconds ||
                preferredPerShot;
              const apiPer =
                planRes.data.timing?.apiPerShotSeconds ||
                Math.max(durationBounds.min, per);
              const total = Math.min(
                MAX_TOTAL_SECONDS,
                planRes.data.timing?.totalSeconds ||
                  planRes.data.totalSeconds ||
                  per * count,
              );
              nextHint = {
                count,
                totalCredits:
                  typeof planRes.data.totalCredits === "number"
                    ? planRes.data.totalCredits
                    : null,
                actions: planRes.data.actions || [],
                preferredPerShot,
                preferredTotalSeconds: preferredTotal,
                perShotSeconds: per,
                apiPerShotSeconds: apiPer,
                totalSeconds: total,
                labelAr:
                  planRes.data.timing?.labelAr ||
                  `توصية: ${count} لقطات × ${per} ثوانٍ = ${total} ثانية`,
              };
              if (typeof planRes.data.totalCredits === "number") {
                nextCost = planRes.data.totalCredits;
              }
              // Do NOT setDuration here — overwriting snaps the slider back
              // (e.g. user picks 30s, quote returns 2×2s=4s).
            }
          } catch {
            // Keep single-clip quote if plan fails.
          }
        }

        if (cancelled) return;
        setShotHint(nextHint);
        setCreditCost(nextCost);
        const quote = data.quotes?.[0];
        const live = Boolean(
          data.liveOpenArt ||
            data.synced ||
            (quote?.available &&
              (quote.source === "openart" || quote.source === "openart-cache")),
        );
        setCreditLive(live);
        if (!live) {
          setQuoteError("لم تُزامن التكلفة بعد — اختر موديلًا متاحًا أو أعد المحاولة");
        }
      } catch (err) {
        if (!cancelled) {
          setCreditLive(false);
          setCreditCost(null);
          setFreeTrial(false);
          setShotHint(null);
          setQuoteError(err instanceof Error ? err.message : "تعذر مزامنة تكلفة الكريدت");
        }
      } finally {
        if (!cancelled) setQuoting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    selectedModelId,
    media,
    aspectRatio,
    resolution,
    duration,
    generateAudio,
    refs.length,
    startFrame,
    user?.freeVeronixUsed,
    user?.credits,
    user?.id,
    prompt,
    multiShotOn,
    promptSceneState,
  ]);

  async function uploadFile(file: File, purpose: "create-image" | "create-video") {
    const form = new FormData();
    form.append("file", file);
    form.append("purpose", purpose);
    form.append("label", file.name || "reference");
    const { res, data } = await fetchJson<{
      error?: string;
      visualReference?: VisualReference;
      needsOwnerSetup?: boolean;
    }>("/api/upload", { method: "POST", body: form });
    if (!res.ok) {
      if (data.needsOwnerSetup) {
        setPlatformReady(false);
        throw new Error(
          "رفع الصور يحتاج ربط حساب المنصة مرة واحدة. افتح /setup/openart وأكمل الدخول ثم أعد المحاولة.",
        );
      }
      const msg = data.error || "فشل رفع الصورة";
      if (/OPENART_ACCESS_TOKEN|Platform OpenArt|not connected|حساب المنصة/i.test(msg)) {
        setPlatformReady(false);
        throw new Error(
          "رفع الصور يحتاج ربط حساب المنصة مرة واحدة. افتح /setup/openart وأكمل الدخول ثم أعد المحاولة.",
        );
      }
      throw new Error(msg);
    }
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

  async function handleFrame(file: File | undefined, which: "start" | "end") {
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

  async function previewToDataUrl(preview: string | null | undefined): Promise<string | null> {
    if (!preview) return null;
    try {
      if (preview.startsWith("data:")) return preview;
      const res = await fetch(preview);
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!blob.type.startsWith("image/") || blob.size > 3_500_000) return null;
      const buf = await blob.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      return `data:${blob.type || "image/jpeg"};base64,${btoa(binary)}`;
    } catch {
      return null;
    }
  }

  async function handleEnhance() {
    if (!prompt.trim()) return;
    setEnhancing(true);
    setError(null);
    try {
      // Prefer data URLs from local previews so vision can read pixels even if CDN blocks server fetch.
      const dataCandidates = await Promise.all([
        previewToDataUrl(startPreview),
        previewToDataUrl(endPreview),
        ...refPreviews.slice(0, 2).map((p) => previewToDataUrl(p)),
      ]);
      const imageUrls = [
        ...dataCandidates.filter((u): u is string => Boolean(u)),
        startFrame?.url,
        endFrame?.url,
        ...refs.map((r) => r.url),
      ].filter((u): u is string => Boolean(u && String(u).trim()));
      // Dedupe, keep data URLs first, max 2 for vision payload size.
      const uniqueUrls = [...new Set(imageUrls)].slice(0, 2);

      const { res, data } = await fetchJson<{
        enhanced?: string;
        error?: string;
        finalState?: SceneState;
        visionUsed?: boolean;
        needsVisionKey?: boolean;
        chained?: boolean;
        entityBrief?: string;
        multiShot?: boolean;
        shotCount?: number;
        shots?: Array<{ prompt: string; action: string }>;
      }>("/api/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          mode: media === "image" ? "text-to-image" : "text-to-video",
          imageUrls: uniqueUrls,
          previousState: promptSceneState,
        }),
      });
      if (!res.ok) throw new Error(data.error || "Enhance failed");
      const next = (data.enhanced || "").trim();
      if (!next) throw new Error("لم يتم إنشاء وصف محسّن");
      // Full replace — never append polish onto the existing field.
      setPrompt(next);
      if (data.multiShot && (data.shots?.length || 0) >= 2) {
        // Fresh multi-shot script — do not keep prior end-pose as "previous"
        // (it was leaking late actions like overhead lift into shot 1).
        setPromptSceneState(null);
        setPlannedShots(data.shots || null);
        setMultiShotOn(true);
        const count = Math.min(
          MAX_SHOTS,
          data.shotCount || data.shots!.length,
        );
        const preferredPerShot = PRODUCT_PER_SHOT_SECONDS;
        const preferredTotal = preferredPerShot * count;
        const per = preferredPerShot;
        const apiPer = Math.max(durationBounds.min, preferredPerShot);
        const total = Math.min(MAX_TOTAL_SECONDS, per * count);
        setShotHint({
          count,
          totalCredits: null,
          actions: data.shots!.map((s) => s.action),
          preferredPerShot,
          preferredTotalSeconds: preferredTotal,
          perShotSeconds: per,
          apiPerShotSeconds: apiPer,
          totalSeconds: total,
          labelAr: `توصية: ${count} لقطات × ${per} ثوانٍ = ${total} ثانية`,
        });
        // Suggest total only if slider is still on a low default (≤4s).
        setDuration((prev) =>
          prev <= FREE_VERONIX_DURATION_SECONDS
            ? total
            : Math.min(MAX_TOTAL_SECONDS, Math.max(prev, total)),
        );
      } else {
        setPlannedShots(null);
        if (data.finalState) setPromptSceneState(data.finalState);
      }

      if (data.needsVisionKey) {
        setStatus(
          "التحسين تم بدون قراءة ملابس الصورة — أضف OPENAI_API_KEY أو GEMINI_API_KEY على السيرفر لاستبدال الأنثى/الرجل بالمواصفات",
        );
      } else if (uniqueUrls.length && !data.visionUsed) {
        setStatus(
          "التحسين تم — تعذّر قراءة تفاصيل الصورة الآن؛ أعد رفع الصورة أو جرّب صورة أوضح ثم «تحسين الوصف»",
        );
      } else {
        const bits = ["تم تحسين الوصف"];
        if (data.visionUsed) bits.push("مع استبدال الشخصيات بمواصفات الصورة");
        if (data.chained) bits.push("وتسلسل من الحالة السابقة");
        if (data.multiShot && (data.shotCount || 0) >= 2) {
          bits.push(`وتقسيم إلى ${data.shotCount} لقطات من السياق`);
        }
        setStatus(bits.join(" · "));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enhance failed");
    } finally {
      setEnhancing(false);
    }
  }

  /** Cache remotely + apply clarity grade for a stable local preview URL. */
  async function finalizePaidVideo(input: {
    url: string;
    historyId?: string;
    assetId?: string;
  }): Promise<string> {
    const { res, data } = await fetchJson<{ error?: string; url?: string }>(
      "/api/media/cache",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: input.url || undefined,
          historyId: input.historyId || undefined,
          assetId: input.assetId || undefined,
          clarity: true,
        }),
      },
    );
    if (!res.ok || !data.url) {
      throw new Error(data.error || "Unable to fetch video for clarity grade");
    }
    return data.url;
  }

  async function applyBrandOutro(input: {
    url: string;
    historyId?: string;
    assetId?: string;
    mediaType: "image" | "video";
  }) {
    if (input.mediaType !== "video") {
      setPreview({
        url: input.url,
        mediaType: input.mediaType,
        historyId: input.historyId,
        status: "completed",
        freeTrial: true,
      });
      return;
    }
    setStatus("جاري إضافة مقدمة Veronix…");
    setPreview({
      url: "",
      mediaType: "video",
      historyId: input.historyId,
      status: "running",
      freeTrial: true,
    });

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const { res, data } = await fetchJson<{ url?: string; error?: string }>(
          "/api/media/brand-outro",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: input.url,
              historyId: input.historyId,
              assetId: input.assetId,
            }),
          },
        );
        if (!res.ok || !data.url) throw new Error(data.error || "تعذر تجهيز الفيديو");
        setPreview({
          url: data.url,
          mediaType: "video",
          historyId: input.historyId,
          status: "completed",
          freeTrial: true,
        });
        setStatus(null);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error("تعذر تجهيز الفيديو");
        await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
      }
    }

    setPreview({
      url: "",
      mediaType: "video",
      historyId: input.historyId,
      status: "failed",
      freeTrial: true,
    });
    setError(lastError?.message || "تعذر عرض الفيديو بعد التوليد");
    setStatus(null);
  }

  function handleFreeTrialPlay(event: React.SyntheticEvent<HTMLVideoElement>) {
    // Free-trial Play → registration so the customer can watch it from their account.
    if (!preview?.freeTrial) return;
    if (user) return;
    event.preventDefault();
    try {
      event.currentTarget.pause();
    } catch {
      // ignore
    }
    router.push(`/signup?next=${encodeURIComponent("/assets")}`);
  }

  /** Await a single OpenArt history until a media URL is ready (multi-shot). */
  async function waitForHistoryUrl(
    historyId: string,
    startedAt: number,
    label: string,
  ): Promise<string> {
    for (let i = 0; i < PREVIEW_POLL_ATTEMPTS; i += 1) {
      await new Promise((r) => setTimeout(r, PREVIEW_POLL_MS));
      const { res, data } = await fetchJson<{
        status?: string;
        urls?: string[];
        error?: string;
        pollAfterSeconds?: number;
      }>(`/api/status?historyId=${encodeURIComponent(historyId)}`);
      if (!res.ok) continue;
      const st = String(data.status || "").toUpperCase();
      const url = data.urls?.[0];
      if (url) return url;
      if (st === "FAILED" || st === "CANCELLED") {
        throw new Error(data.error || `فشلت ${label}`);
      }
      setStatus(
        `${label}… ${elapsedLabel(Math.floor((Date.now() - startedAt) / 1000))}`,
      );
      if (typeof data.pollAfterSeconds === "number" && data.pollAfterSeconds > 5) {
        await new Promise((r) => setTimeout(r, Math.min(data.pollAfterSeconds! * 1000, 20000)));
      }
    }
    throw new Error(`انتهت مهلة ${label} — افتح Assets للمتابعة`);
  }

  async function pollPreview(
    historyId: string,
    mediaType: "image" | "video",
    startedAt: number,
    brandOutro: boolean,
    assetId?: string,
  ) {
    for (let i = 0; i < PREVIEW_POLL_ATTEMPTS; i += 1) {
      await new Promise((r) => setTimeout(r, PREVIEW_POLL_MS));
      try {
        const { res, data } = await fetchJson<{
          status?: string;
          urls?: string[];
          error?: string;
          pollAfterSeconds?: number;
        }>(`/api/status?historyId=${encodeURIComponent(historyId)}`);
        if (!res.ok) continue;
        const st = String(data.status || "").toUpperCase();
        const url = data.urls?.[0];
        if (url) {
          if (brandOutro) {
            await applyBrandOutro({ url, historyId, assetId, mediaType });
          } else if (mediaType === "video") {
            setStatus("تحسين الوضوح والفلتر…");
            try {
              const graded = await finalizePaidVideo({ url, historyId, assetId });
              setPreview({
                url: graded,
                mediaType,
                historyId,
                status: "completed",
              });
            } catch {
              setPreview({ url, mediaType, historyId, status: "completed" });
            }
            setStatus(null);
          } else {
            setPreview({ url, mediaType, historyId, status: "completed" });
            setStatus(null);
          }
          setGenStartedAt(null);
          return;
        }
        if (st === "FAILED" || st === "CANCELLED") {
          setPreview({ url: "", mediaType, historyId, status: "failed" });
          setError(data.error || "فشل التوليد");
          setGenStartedAt(null);
          return;
        }
        setPreview((prev) =>
          prev
            ? { ...prev, status: "running" }
            : { url: "", mediaType, historyId, status: "running" },
        );
        setStatus(`Generating… ${elapsedLabel(Math.floor((Date.now() - startedAt) / 1000))}`);
        if (typeof data.pollAfterSeconds === "number" && data.pollAfterSeconds > 5) {
          await new Promise((r) => setTimeout(r, Math.min(data.pollAfterSeconds! * 1000, 20000)));
        }
      } catch {
        // Keep waiting — tunnel blips should not abort a long Seedance job.
      }
    }
    setStatus("ما زال التوليد جاريًا — افتح Assets لمتابعة النتيجة");
  }

  function elapsedLabel(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  async function handleShare() {
    if (!preview?.url) return;
    setShareNote(null);
    const shareUrl =
      typeof window !== "undefined" ? `${window.location.origin}/assets` : "/assets";
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Veronix.ai",
          text: prompt.trim() || "Generated with Veronix.ai",
          url: shareUrl,
        });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setShareNote("تم نسخ رابط المشاركة");
    } catch {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setShareNote("تم نسخ رابط المشاركة");
      } catch {
        setShareNote("تعذر المشاركة — انسخ الرابط يدوياً");
      }
    }
  }

  async function handleDownload() {
    if (!preview?.url && !preview?.historyId) return;
    setShareNote(null);
    const path = veronixDownloadPath({
      historyId: preview.historyId,
      url: preview.url,
      mediaType: preview.mediaType,
    });
    if (!path) {
      setShareNote("الملف غير جاهز للتحميل");
      return;
    }
    try {
      const res = await fetch(path, { credentials: "same-origin" });
      if (!res.ok) throw new Error("download failed");
      const blob = await res.blob();
      const ext = preview.mediaType === "video" ? "mp4" : "png";
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `veronix-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Same-origin fallback only — never open OpenArt CDN in a new tab.
      const a = document.createElement("a");
      a.href = path;
      a.download = `veronix-${Date.now()}.${preview.mediaType === "video" ? "mp4" : "png"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }

  async function createOneClip(input: {
    prompt: string;
    mode: string;
    duration: number;
    startFrame?: VisualReference | null;
    endFrame?: VisualReference | null;
    /** Hide intermediate multi-shot clips from Assets */
    sequencePart?: boolean;
  }) {
    const { res, data } = await fetchJson<{
      error?: string;
      needsAuth?: boolean;
      needsPaywall?: boolean;
      freeTrial?: boolean;
      results?: Array<{
        error?: string;
        status?: string;
        historyId?: string;
        assetId?: string;
        urls?: string[];
        needsBrandOutro?: boolean;
      }>;
    }>("/api/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        modelIds: [selectedModelId],
        media,
        mode: input.mode,
        prompt: input.prompt,
        aspectRatio: media === "video" ? VIDEO_ASPECT : aspectRatio,
        resolution: media === "video" ? resolution : undefined,
        duration: media === "video" ? input.duration : undefined,
        generateAudio: media === "video" ? generateAudio : undefined,
        startFrame: input.startFrame ?? null,
        endFrame: input.endFrame ?? null,
        referenceImages: refs,
        waitForResult: false,
        sequencePart: Boolean(input.sequencePart),
      }),
    });
    return { res, data };
  }

  /** Parse enhance script lines: "لقطة 1: …" / "Shot 1: …" into generation shots. */
  function parseShotScriptLines(
    text: string,
  ): Array<{ prompt: string; action: string }> | null {
    const lines = text
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    const shots: Array<{ prompt: string; action: string }> = [];
    for (const line of lines) {
      const m = line.match(/^(?:لقطة|Shot)\s*\d+\s*[:：\-]\s*(.+)$/i);
      if (!m?.[1]) continue;
      const action = m[1].trim();
      if (action.length < 3) continue;
      const arabic = /[\u0600-\u06FF]/.test(action);
      shots.push({
        action,
        prompt: arabic
          ? `مشهد سينمائي واقعي: ${action}. لقطة واحدة فقط، نفّذ هذا الفعل كما هو مكتوب دون إضافة أحداث أو وضعيات من لقطات أخرى. إضاءة طبيعية سينمائية، تفاصيل حادة، بدون تشويش`
          : `Cinematic realistic scene: ${action}. one shot only, perform this action as written, do not add events from other shots. natural cinematic light, sharp detail, no flicker`,
      });
    }
    return shots.length >= 2 ? shots.slice(0, MAX_SHOTS) : null;
  }

  async function handleGenerate() {
    setError(null);
    setStatus(null);
    setShareNote(null);
    setPreview(null);

    if (!user) {
      router.push(`/signup?next=${encodeURIComponent("/")}&paywall=1`);
      return;
    }
    if (!prompt.trim()) {
      setError("اكتب وصفًا أولًا.");
      return;
    }
    if (!selectedModel?.available) {
      setError("هذا الموديل غير متاح للتوليد حاليًا. اختر موديلًا متاحًا.");
      return;
    }
    if (creditCost == null || !creditLive) {
      setError(quoteError || "انتظر حساب التكلفة قبل التوليد.");
      return;
    }
    if (!freeTrial && (user.credits <= 0 || user.credits < creditCost)) {
      setError("رصيدك غير كافٍ. أضف كريدت أو رقِّ الباقة للمتابعة.");
      router.push("/pricing?paywall=1");
      return;
    }

    const startedAt = Date.now();
    setGenerating(true);
    setGenStartedAt(startedAt);
    setElapsedSec(0);
    // Paid balance always unlocks multi-shot for this run (ignore stale freeTrial flag).
    const canPayMulti =
      media === "video" &&
      multiShotOn &&
      ((user.credits ?? 0) > 0 || Boolean(user.freeVeronixUsed));
    if (canPayMulti) setFreeTrial(false);

    setStatus(
      canPayMulti
        ? "تخطيط اللقطات المتعددة…"
        : freeTrial
          ? "جاري توليد فيديوك المجاني…"
          : "Generating…",
    );
    try {
      // Plan multi-shot from context (no ثم required) — paid video only.
      let useMulti = false;
      let shots: Array<{ prompt: string; action: string }> = [];
      // Seedance/Veronix: each beat = 4s. Slider = total budget (up to 32s).
      let perShotSeconds = PRODUCT_PER_SHOT_SECONDS;
      let apiPerShotSeconds = Math.min(
        durationBounds.max,
        Math.max(durationBounds.min, PRODUCT_PER_SHOT_SECONDS),
      );
      if (canPayMulti) {
        if (plannedShots && plannedShots.length >= 2) {
          useMulti = true;
          shots = plannedShots;
        } else {
          const fromScript = parseShotScriptLines(prompt.trim());
          if (fromScript) {
            useMulti = true;
            shots = fromScript;
            setPlannedShots(fromScript);
          } else {
            const planRes = await fetchJson<{
              error?: string;
              autoMultiShot?: boolean;
              perShotSeconds?: number;
              totalSeconds?: number;
              timing?: {
                labelAr?: string;
                perShotSeconds?: number;
                totalSeconds?: number;
                preferredPerShot?: number;
                preferredTotalSeconds?: number;
                apiPerShotSeconds?: number;
              };
              plan?: { shots?: Array<{ prompt: string; action: string }> };
              actions?: string[];
              shotCount?: number;
              totalCredits?: number | null;
            }>("/api/shots/plan", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: prompt.trim(),
                modelId: selectedModelId,
                media,
                // Pass slider total — not 4 — so free-trial heuristics never misfire.
                duration: Math.max(PRODUCT_PER_SHOT_SECONDS, duration),
                resolution,
                generateAudio,
                aspectRatio: VIDEO_ASPECT,
                previousState: promptSceneState,
                multiShot: true,
              }),
            });
            if (
              planRes.res.ok &&
              planRes.data.autoMultiShot &&
              (planRes.data.plan?.shots?.length || 0) >= 2
            ) {
              useMulti = true;
              shots = planRes.data.plan!.shots!;
              setPlannedShots(shots);
              const count = Math.min(
                MAX_SHOTS,
                planRes.data.shotCount || shots.length,
              );
              const preferredPerShot = PRODUCT_PER_SHOT_SECONDS;
              const preferredTotal = preferredPerShot * count;
              const apiPer = Math.min(
                durationBounds.max,
                Math.max(durationBounds.min, PRODUCT_PER_SHOT_SECONDS),
              );
              const total = Math.min(MAX_TOTAL_SECONDS, preferredTotal);
              setShotHint({
                count,
                totalCredits:
                  typeof planRes.data.totalCredits === "number"
                    ? planRes.data.totalCredits
                    : null,
                actions: planRes.data.actions || shots.map((s) => s.action),
                preferredPerShot,
                preferredTotalSeconds: preferredTotal,
                perShotSeconds: PRODUCT_PER_SHOT_SECONDS,
                apiPerShotSeconds: apiPer,
                totalSeconds: total,
                labelAr:
                  planRes.data.timing?.labelAr ||
                  `توصية: ${count} لقطات × ${PRODUCT_PER_SHOT_SECONDS} ثوانٍ = ${total} ثانية`,
              });
            }
          }
        }
      }

      if (
        canPayMulti &&
        !useMulti &&
        (/ثم|\bthen\b|لقطة\s*\d+|Shot\s*\d+/i.test(prompt) ||
          (shotHint?.count || 0) >= 2)
      ) {
        throw new Error(
          "تعذر بدء اللقطات المتعددة — اضغط «تحسين الوصف» ثم أعد التوليد",
        );
      }

      if (useMulti && shots.length >= 2) {
        // Fixed 4s/shot (Seedance min). Slider budget caps how many shots run.
        perShotSeconds = PRODUCT_PER_SHOT_SECONDS;
        apiPerShotSeconds = Math.min(
          durationBounds.max,
          Math.max(durationBounds.min, PRODUCT_PER_SHOT_SECONDS),
        );
        const shotBudget = Math.max(
          2,
          Math.min(
            MAX_SHOTS,
            Math.floor(
              Math.min(MAX_TOTAL_SECONDS, Math.max(PRODUCT_PER_SHOT_SECONDS, duration)) /
                PRODUCT_PER_SHOT_SECONDS,
            ),
          ),
        );
        if (shots.length > shotBudget) {
          shots = shots.slice(0, shotBudget);
        }
        // Ensure slider/total matches the shots we will actually generate.
        setDuration(shots.length * PRODUCT_PER_SHOT_SECONDS);
        setStatus(`توليد ${shots.length} لقطات × ${PRODUCT_PER_SHOT_SECONDS}ث ثم الدمج…`);
        setPreview({ url: "", mediaType: "video", status: "running" });
        const localUrls: string[] = [];
        const partAssetIds: string[] = [];
        let frame: VisualReference | null = startFrame;

        const revealParts = async () => {
          if (!partAssetIds.length) return;
          try {
            await fetchJson("/api/assets/visibility", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ assetIds: partAssetIds, hidden: false }),
            });
          } catch {
            // Assets GET also recovers orphans.
          }
        };

        try {
          for (let i = 0; i < shots.length; i += 1) {
            const shot = shots[i]!;
            const label = `لقطة ${i + 1} من ${shots.length}`;
            setStatus(
              `${label} (${perShotSeconds}ث): ${shot.action.slice(0, 40)}… — ثم تُدمج في فيديو واحد`,
            );
            const mode = frame ? "image2video" : "text2video";
            const { res, data } = await createOneClip({
              prompt: shot.prompt,
              mode,
              duration: apiPerShotSeconds,
              startFrame: frame,
              endFrame: i === 0 ? endFrame : null,
              sequencePart: true,
            });

            if (res.status === 401 || data.needsAuth) {
              await revealParts();
              router.push(`/signup?next=${encodeURIComponent("/")}&paywall=1`);
              return;
            }
            if (res.status === 402 || data.needsPaywall) {
              await revealParts();
              setError(data.error || "رصيدك غير كافٍ لإكمال اللقطات.");
              router.push("/pricing?paywall=1");
              return;
            }
            if (!res.ok) throw new Error(data.error || `فشل ${label}`);
            const failed = data.results?.find((r) => r.error);
            if (failed?.error) throw new Error(failed.error);

            const ok = data.results?.find((r) => !r.error);
            let url = ok?.urls?.[0] || "";
            const historyId = ok?.historyId;
            const assetId = ok?.assetId;
            if (assetId) partAssetIds.push(assetId);
            if (!url && historyId) {
              setPreview({
                url: "",
                mediaType: "video",
                historyId,
                status: "running",
              });
              url = await waitForHistoryUrl(historyId, startedAt, label);
            }
            if (!url && !historyId) throw new Error(`لا يوجد فيديو من ${label}`);

            // Persist + clarity-grade each beat so the stitch inherits the filter.
            setStatus(`حفظ وتحسين وضوح ${label}…`);
            const cacheRes = await fetchJson<{ error?: string; url?: string }>(
              "/api/media/cache",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  videoUrl: url || undefined,
                  historyId: historyId || undefined,
                  assetId: assetId || undefined,
                  clarity: true,
                }),
              },
            );
            const localUrl = cacheRes.res.ok ? cacheRes.data.url : null;
            if (!localUrl) {
              throw new Error(
                cacheRes.data.error || `تعذر حفظ ${label} للدمج في فيديو واحد`,
              );
            }
            localUrls.push(localUrl);

            // Assembling — parts stay hidden until final stitch (or reveal on failure).
            setPreview({
              url: "",
              mediaType: "video",
              historyId,
              status: "running",
            });

            if (i < shots.length - 1) {
              setStatus(`استخراج إطار الربط بعد ${label}…`);
              const frameRes = await fetchJson<{
                error?: string;
                visualReference?: VisualReference;
              }>("/api/media/extract-frame", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  videoUrl: localUrl,
                  label: `bridge-${i + 1}`,
                }),
              });
              if (!frameRes.res.ok || !frameRes.data.visualReference) {
                throw new Error(
                  frameRes.data.error || "تعذر استخراج إطار الربط بين اللقطات",
                );
              }
              frame = frameRes.data.visualReference;
            }
          }

          if (localUrls.length < 2) {
            await revealParts();
            throw new Error(
              `اكتملت لقطة واحدة فقط من ${shots.length} — أعد التوليد لإكمال المشهد المدمج`,
            );
          }

          setStatus(`دمج ${localUrls.length} لقطات + تحسين الوضوح…`);
          let concatUrl: string | null = null;
          let concatError = "";
          for (let attempt = 0; attempt < 3; attempt += 1) {
            const concatRes = await fetchJson<{
              error?: string;
              url?: string;
              assetId?: string;
            }>("/api/media/concat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                videoUrls: localUrls,
                saveAsset: true,
                prompt: prompt.trim(),
                modelId: selectedModelId,
                shotCount: shots.length,
                maxSecondsPerClip: perShotSeconds,
                // Last attempt: skip clarity grade if stitch+grade is unstable.
                clarity: attempt < 2,
              }),
            });
            if (concatRes.res.ok && concatRes.data.url) {
              concatUrl = concatRes.data.url;
              break;
            }
            concatError = concatRes.data.error || "تعذر دمج اللقطات";
            await new Promise((r) => setTimeout(r, 1500));
          }

          if (!concatUrl) {
            await revealParts();
            setError(
              `${concatError}. تم توليد ${localUrls.length} لقطات وظهرت في Assets — لم يكتمل الدمج في فيديو واحد.`,
            );
            // Prefer first clip over last so preview is not a random tail beat.
            const fallback = localUrls[0] || "";
            setPreview({
              url: fallback,
              mediaType: "video",
              status: fallback ? "completed" : "failed",
            });
            setGenStartedAt(null);
            await onUserRefresh();
            return;
          }

          // Final video is the only visible Assets entry; keep parts hidden.
          if (partAssetIds.length) {
            await fetchJson("/api/assets/visibility", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ assetIds: partAssetIds, hidden: true }),
            }).catch(() => undefined);
          }

          setPreview({
            url: concatUrl,
            mediaType: "video",
            status: "completed",
          });
          setStatus(
            `فيديو واحد جاهز · ${shots.length} لقطات × ${perShotSeconds}ث = ${shots.length * perShotSeconds}ث`,
          );
          setGenStartedAt(null);
          await onUserRefresh();
          return;
        } catch (multiErr) {
          await revealParts();
          throw multiErr;
        }
      }

      // Single-clip path (images, free trial, or one action)
      const mode =
        media === "image"
          ? refs.length
            ? "image2image"
            : "text2image"
          : startFrame
            ? "image2video"
            : "text2video";

      const { res, data } = await createOneClip({
        prompt: prompt.trim(),
        mode,
        duration,
        startFrame,
        endFrame,
      });

      if (res.status === 401 || data.needsAuth) {
        router.push(`/signup?next=${encodeURIComponent("/")}&paywall=1`);
        return;
      }
      if (res.status === 402 || data.needsPaywall) {
        setError(data.error || "رصيدك غير كافٍ. أضف كريدت أو رقِّ الباقة.");
        router.push("/pricing?paywall=1");
        return;
      }
      if (!res.ok) throw new Error(data.error || "فشل التوليد");

      const failed = data.results?.find((r) => r.error);
      if (failed?.error) {
        setError(failed.error);
        setGenStartedAt(null);
        return;
      }

      const ok = data.results?.find((r) => !r.error);
      const firstUrl = ok?.urls?.[0] || "";
      const historyId = ok?.historyId;
      const assetId = ok?.assetId;
      const brand = Boolean(data.freeTrial || ok?.needsBrandOutro);
      if (firstUrl) {
        if (brand) {
          await applyBrandOutro({
            url: firstUrl,
            historyId,
            assetId,
            mediaType: media,
          });
        } else if (media === "video") {
          setStatus("تحسين الوضوح والفلتر…");
          try {
            const graded = await finalizePaidVideo({
              url: firstUrl,
              historyId,
              assetId,
            });
            setPreview({
              url: graded,
              mediaType: media,
              historyId,
              status: "completed",
            });
          } catch (gradeErr) {
            setPreview({
              url: firstUrl,
              mediaType: media,
              historyId,
              status: "completed",
            });
            setError(
              gradeErr instanceof Error
                ? gradeErr.message
                : "تعذر تطبيق فلتر الوضوح — عُرض الفيديو الأصلي",
            );
          }
          setStatus(null);
        } else {
          setPreview({
            url: firstUrl,
            mediaType: media,
            historyId,
            status: "completed",
          });
          setStatus(null);
        }
        setGenStartedAt(null);
      } else if (historyId) {
        setPreview({
          url: "",
          mediaType: media,
          historyId,
          status: "running",
        });
        setStatus("Generating…");
        void pollPreview(historyId, media, startedAt, brand, assetId);
      } else {
        setStatus("تم إرسال الطلب — افتح Assets لمتابعة النتيجة");
        setGenStartedAt(null);
      }

      await onUserRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل التوليد");
      setGenStartedAt(null);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-3 pb-8 pt-4 sm:px-6" dir="rtl">
      {platformReady === false && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
          رفع الصور والتوليد يحتاجان ربط حساب المنصة مرة واحدة.{" "}
          <a href="/setup/openart" className="font-semibold text-[#22f0ff] underline-offset-2 hover:underline">
            اربط حساب المنصة الآن
          </a>
        </div>
      )}

      {(error || status) && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            error
              ? "border-rose-400/30 bg-rose-400/10 text-rose-100"
              : "border-cyan-400/25 bg-cyan-400/10 text-cyan-50"
          }`}
        >
          {error?.includes("/setup/openart") ? (
            <>
              رفع الصور يحتاج ربط حساب المنصة مرة واحدة.{" "}
              <a
                href="/setup/openart"
                className="font-semibold text-[#22f0ff] underline-offset-2 hover:underline"
              >
                اربط حساب المنصة الآن
              </a>
            </>
          ) : (
            (error ?? status)
          )}
        </div>
      )}

      {media === "video" &&
        selectedModelId === VERONIX_MODEL_ID &&
        !user?.freeVeronixUsed && (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-50">
            أول فيديو على <span className="font-semibold">Veronix</span> مجاني مرة واحدة —{" "}
            <span className="font-semibold">مقدمة Veronix + 4 ثوانٍ · 480p</span>.
          </div>
        )}

      {!lockedMedia && (
        <div className="flex gap-2">
          {(
            [
              { id: "image" as const, label: "صورة" },
              { id: "video" as const, label: "فيديو" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMedia(item.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                media === item.id ? "bg-white text-black" : "border border-white/10 text-white/70"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {lockedMedia && (
        <div className="inline-flex items-center gap-2 rounded-full border border-[#22f0ff]/25 bg-[#22f0ff]/10 px-3 py-1.5 text-xs font-semibold text-[#22f0ff]">
          {lockedMedia === "video" ? "استوديو الفيديو" : "استوديو الصور"}
          <span className="text-white/40">·</span>
          <span className="font-normal text-white/55">
            {lockedMedia === "video" ? "موديلات الفيديو فقط" : "موديلات الصور فقط"}
          </span>
        </div>
      )}

      <label className="block rounded-2xl border border-white/10 bg-[#141821] px-4 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-[0.16em] text-white/40">الموديل</p>
          <ChevronDown className="h-4 w-4 text-white/50" />
        </div>
        <select
          value={selectedModelId}
          onChange={(e) => {
            const id = e.target.value;
            setSelectedModelId(id);
            const videoModel = videoModels.find((m) => m.id === id);
            if (videoModel) {
              if (!lockedMedia) setMedia("video");
              applyVideoModelDefaults(videoModel);
              return;
            }
            if (imageModels.some((m) => m.id === id)) {
              if (!lockedMedia) setMedia("image");
              setAspectRatio("1:1");
            }
          }}
          className="w-full appearance-none rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none"
        >
          {(media === "image" ? imageModels : videoModels).map((model) => (
            <option
              key={model.id}
              value={model.id}
              disabled={!model.available}
            >
              {model.available
                ? model.name
                : `${model.name} · قريبًا`}
            </option>
          ))}
        </select>
        {selectedModel?.tagline ? (
          <p className="mt-2 text-xs text-white/45">{selectedModel.tagline}</p>
        ) : (
          <p className="mt-2 text-xs text-white/45">اختيار موديل واحد فقط</p>
        )}
      </label>

      <div className="rounded-2xl border border-dashed border-white/15 bg-[#141821] p-4">
        <p className="mb-2 text-sm font-medium text-white/80">مراجع بصرية (اختياري)</p>
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
            media === "image" ? "صف الصورة التي تريدها…" : "صف مشهد الفيديو والحركة…"
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
            disabled={enhancing || !prompt.trim()}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70 disabled:opacity-50"
          >
            {enhancing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#22f0ff]" />
            ) : (
              <WandSparkles className="h-3.5 w-3.5 text-[#22f0ff]" />
            )}
            {enhancing ? "جاري التحسين…" : "تحسين الوصف"}
          </button>
          {promptSceneState ? (
            <button
              type="button"
              onClick={() => {
                setPromptSceneState(null);
                setStatus("تم مسح سلسلة الحالة — المشهد التالي يبدأ من الصفر");
              }}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/50"
              title="إعادة ضبط تسلسل الأفعال"
            >
              تصفير التسلسل
            </button>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#141821] p-4">
        <p className="mb-3 text-sm font-semibold text-white">Output</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-white/50">
            النسبة
            <select
              value={media === "video" ? VIDEO_ASPECT : aspectRatio}
              onChange={(e) => {
                if (media === "video") return;
                setAspectRatio(e.target.value);
              }}
              disabled={media === "video"}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white disabled:opacity-70"
            >
              {media === "video" ? (
                <option value={VIDEO_ASPECT}>{VIDEO_ASPECT} · ثابت</option>
              ) : (
                IMAGE_ASPECTS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))
              )}
            </select>
          </label>
          {media === "video" && resolutionOptions.length > 0 && (
            <label className="space-y-1 text-xs text-white/50">
              الوضوح
              <select
                value={
                  resolutionOptions.includes(resolution)
                    ? resolution
                    : formOptions.resolutionDefault || resolutionOptions[0]
                }
                onChange={(e) => setResolution(e.target.value)}
                disabled={freeSettingsLocked}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white disabled:opacity-60"
              >
                {resolutionOptions.map((r) => (
                  <option key={r} value={r}>
                    {resolutionLabel(r)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {media === "video" && resolutionOptions.length === 0 && (
            <p className="text-xs text-white/40">الوضوح: تلقائي لهذا الموديل</p>
          )}
        </div>

        {media === "video" && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/70">
                {multiDurationMode ? "مدة الفيديو" : "المدة"}
              </span>
              <span className="font-semibold tabular-nums text-[#22f0ff]">
                {Math.min(sliderMax, Math.max(sliderMin, duration))}ث
                {freeSettingsLocked ? " · مجاني أول مرة" : ""}
              </span>
            </div>
            <input
              type="range"
              min={sliderMin}
              max={sliderMax}
              step={multiDurationMode ? PRODUCT_PER_SHOT_SECONDS : 1}
              value={Math.min(sliderMax, Math.max(sliderMin, duration))}
              disabled={freeSettingsLocked}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!multiDurationMode) {
                  setDuration(raw);
                  return;
                }
                // Snap to 4s steps (Seedance min per shot).
                const stepped =
                  Math.round(raw / PRODUCT_PER_SHOT_SECONDS) *
                  PRODUCT_PER_SHOT_SECONDS;
                setDuration(
                  Math.min(
                    MAX_TOTAL_SECONDS,
                    Math.max(PRODUCT_PER_SHOT_SECONDS, stepped),
                  ),
                );
              }}
              className="w-full accent-[#22f0ff] disabled:opacity-60"
            />
            <div className="flex justify-between text-[10px] text-white/35">
              <span>{sliderMin}s</span>
              {selectedModelId === VERONIX_MODEL_ID && !user?.freeVeronixUsed ? (
                <span className="text-[#22f0ff]">تجربة مجانية</span>
              ) : (
                <span className="text-[#22f0ff]">أقصى {sliderMax}s</span>
              )}
              <span>{sliderMax}s</span>
            </div>
            {formOptions.audioSupported ? (
              <label className="mt-2 flex items-center gap-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={generateAudio}
                  disabled={freeSettingsLocked}
                  onChange={(e) => setGenerateAudio(e.target.checked)}
                />
                توليد صوت
                {freeSettingsLocked ? (
                  <span className="text-[10px] text-white/40">(مفعّل في التجربة المجانية)</span>
                ) : null}
              </label>
            ) : (
              <p className="mt-2 text-xs text-white/40">
                لا يتوفر خيار صوت منفصل لهذا الموديل
              </p>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => void handleGenerate()}
        disabled={generating || quoting || !selectedModel?.available}
        className="relative z-20 flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-5 py-4 text-base font-bold text-white disabled:opacity-70"
      >
        {generating || quoting ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Sparkles className="h-5 w-5" />
        )}
        {generating
          ? "جاري التوليد…"
          : quoting
            ? "يحسب السعر…"
            : freeTrial
              ? "Generate مجاني"
              : "Generate"}
        <span className="rounded-full bg-black/20 px-2.5 py-0.5 text-xs tabular-nums">
          {quoting
            ? "…"
            : creditLive && creditCost != null
              ? freeTrial
                ? "مجاني"
                : `−${creditCost}`
              : "—"}
        </span>
      </button>

      {(preview || waitingResult) && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#141821]">
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
            <p className="text-sm font-semibold text-white">معاينة النتيجة</p>
            {waitingResult && (
              <span className="inline-flex items-center gap-1 text-xs tabular-nums text-[#22f0ff]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating · {elapsedLabel(elapsedSec)}
              </span>
            )}
          </div>
          <div className="relative aspect-video bg-black/50">
            {preview?.url && preview.mediaType === "video" ? (
              <video
                key={preview.url}
                src={
                  veronixMediaSrc({
                    historyId: preview.historyId,
                    url: preview.url,
                    mediaType: "video",
                  }) || undefined
                }
                controls
                playsInline
                controlsList="nodownload"
                onPlay={handleFreeTrialPlay}
                className="h-full w-full object-contain"
              />
            ) : preview?.url && preview.mediaType === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={
                  veronixMediaSrc({
                    historyId: preview.historyId,
                    url: preview.url,
                    mediaType: "image",
                  }) || preview.url
                }
                alt="preview"
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-white/40">
                {waitingResult ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-[#22f0ff]" />
                    <p className="text-base font-semibold tracking-wide text-white">
                      Generating
                    </p>
                    <p className="tabular-nums text-[#22f0ff]">
                      {elapsedLabel(elapsedSec)}
                    </p>
                    <p className="px-6 text-center text-xs text-white/35">
                      الفيديو قد يستغرق عدة دقائق — ستظهر المعاينة هنا تلقائيًا
                    </p>
                  </>
                ) : (
                  "لا توجد معاينة بعد"
                )}
              </div>
            )}
            {waitingResult && preview?.url && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/55">
                <Loader2 className="h-8 w-8 animate-spin text-[#22f0ff]" />
                <p className="mt-2 text-base font-semibold text-white">Generating</p>
                <p className="mt-1 tabular-nums text-[#22f0ff]">
                  {elapsedLabel(elapsedSec)}
                </p>
              </div>
            )}
          </div>
          {preview?.freeTrial ? (
            <div className="border-t border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center text-[11px] text-amber-100/90">
              تجربة مجانية · مقدمة Veronix + 4 ثوانٍ · 480p · مع صوت
            </div>
          ) : null}
          <div className="flex gap-2 p-3">
            <button
              type="button"
              onClick={() => void handleShare()}
              disabled={!preview?.url}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              <Share2 className="h-4 w-4 text-[#22f0ff]" />
              Share
            </button>
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={!preview?.url && !preview?.historyId}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] py-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Download
            </button>
          </div>
          {shareNote && (
            <p className="px-4 pb-3 text-center text-xs text-[#22f0ff]">{shareNote}</p>
          )}
        </div>
      )}

    </div>
  );
}
