"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  VIDEO_CLARITY_LADDER,
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
import { fetchJson } from "@/lib/fetch-json";
import {
  appendCharacterLinkHint,
  isCharacterName,
  matchNamedCharacters,
  normalizeCharacterName,
  resolveCharacterRefsForPrompt,
} from "@/lib/character-names";
import {
  estimateGenerateSeconds,
  formatStudioCountdownLabel,
  inferTargetSecondsFromAsset,
  lockEtaStart,
  remainingGenerateSeconds,
} from "@/lib/generate-eta";
import { veronixDownloadPath, veronixMediaSrc } from "@/lib/media-proxy";
import { clearEditDraft, readEditDraft } from "@/lib/edit-draft";
import type { CustomerUser } from "./AppHeader";

/** Catalog id for VYRONIX image studio (Seedream under the hood). */
const VERONIX_IMAGE_MODEL_ID = "vyronix-image";
const DEFAULT_IMAGE_RESOLUTION = "2K";

/** Default paid length — familiar OpenArt default within 4–15s. */
const DEFAULT_PAID_DURATION_SECONDS = 5;
/** Paid Veronix duration window (slider steps by 1s). */
const PAID_DURATION_MIN = 4;
const PAID_DURATION_MAX = 15;

/** Poll long enough for a slow Seedance beat (~6–7 min). */
const PREVIEW_POLL_ATTEMPTS = 80;
const PREVIEW_POLL_MS = 5000;
const PREVIEW_SESSION_KEY = "veronix.create.preview.v1";
/** Drop restored "running" previews that outlived the job (no server progress). */
const STALE_RUNNING_GRACE_MS = 12 * 60 * 1000;

type StudioPreview = {
  url: string;
  mediaType: "image" | "video";
  historyId?: string;
  status: "running" | "completed" | "failed";
  freeTrial?: boolean;
  assetId?: string;
  /** Output length chosen by the customer — drives countdown ETA */
  targetSeconds?: number;
};

function readStoredPreview(): {
  preview: StudioPreview;
  genStartedAt: number | null;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PREVIEW_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      preview?: StudioPreview;
      genStartedAt?: number | null;
    };
    if (!parsed.preview) return null;
    return {
      preview: parsed.preview,
      genStartedAt:
        typeof parsed.genStartedAt === "number" ? parsed.genStartedAt : null,
    };
  } catch {
    return null;
  }
}

function writeStoredPreview(
  preview: StudioPreview | null,
  genStartedAt: number | null,
) {
  if (typeof window === "undefined") return;
  try {
    if (!preview) {
      sessionStorage.removeItem(PREVIEW_SESSION_KEY);
      return;
    }
    sessionStorage.setItem(
      PREVIEW_SESSION_KEY,
      JSON.stringify({ preview, genStartedAt }),
    );
  } catch {
    // ignore quota / private mode
  }
}

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
  const [selectedModelId, setSelectedModelId] = useState(
    lockedMedia === "image" ? VERONIX_IMAGE_MODEL_ID : VERONIX_MODEL_ID,
  );
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<string>(
    lockedMedia === "image" ? "1:1" : "16:9",
  );
  const [resolution, setResolution] = useState<string>(
    lockedMedia === "image" ? DEFAULT_IMAGE_RESOLUTION : FREE_VERONIX_RESOLUTION,
  );
  const [duration, setDuration] = useState<number>(FREE_VERONIX_DURATION_SECONDS);
  const [generateAudio, setGenerateAudio] = useState(false);
  const [freeTrial, setFreeTrial] = useState(false);
  const [refs, setRefs] = useState<VisualReference[]>([]);
  const [refPreviews, setRefPreviews] = useState<string[]>([]);
  /** Display names aligned with refPreviews / refs (no @ needed in prompt). */
  const [refNames, setRefNames] = useState<string[]>([]);
  const [startFrame, setStartFrame] = useState<VisualReference | null>(null);
  const [endFrame, setEndFrame] = useState<VisualReference | null>(null);
  const [startPreview, setStartPreview] = useState<string | null>(null);
  const [endPreview, setEndPreview] = useState<string | null>(null);
  const [creditCost, setCreditCost] = useState<number | null>(null);
  const [creditLive, setCreditLive] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [generating, setGenerating] = useState(false);
  /** Brief flash so a second Generate tap feels pressed. */
  const [genFlash, setGenFlash] = useState(false);
  /** How many videos to generate in one tap (1–4). */
  const [outputCount, setOutputCount] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [platformReady, setPlatformReady] = useState<boolean | null>(null);
  const [preview, setPreview] = useState<StudioPreview | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [genStartedAt, setGenStartedAt] = useState<number | null>(null);
  const [remainingSec, setRemainingSec] = useState(0);
  const [multiProgress, setMultiProgress] = useState<{
    partCount: number;
    shotCount: number;
  } | null>(null);
  const [previewHydrated, setPreviewHydrated] = useState(false);
  /** Final pose / entities from last enhance — used for sequential actions (ثم…). */
  const [promptSceneState, setPromptSceneState] = useState<SceneState | null>(null);
  const [enhancing, setEnhancing] = useState(false);
  /** Allows starting a new Generate while a previous job continues in Assets. */
  const genRunIdRef = useRef(0);
  /**
   * Multi-beat stitch is no longer the paid default — duration is a native
   * 4–15s Seedance clip. Flag kept for any restored running multi jobs.
   */
  const [multiShotOn, setMultiShotOn] = useState(false);
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

  const linkedCharacters = useMemo(
    () => matchNamedCharacters(prompt, refs),
    [prompt, refs],
  );

  const allModels = useMemo(
    () => [...imageModels, ...videoModels],
    [imageModels, videoModels],
  );
  const selectedModel = allModels.find((m) => m.id === selectedModelId) ?? null;
  const durationBounds = durationBoundsForModel(selectedModel);
  const formOptions = formOptionsForModel(selectedModel);
  /** Paid Veronix: always show full clarity ladder 480p → 4K. */
  const resolutionOptions =
    selectedModelId === VERONIX_MODEL_ID && !freeSettingsLocked
      ? [...VIDEO_CLARITY_LADDER]
      : formOptions.resolutions;
  /** Paid Veronix: native 4–15s slider (1s steps). Free trial: locked 4s. */
  const paidDurationMode = Boolean(
    media === "video" &&
      selectedModelId === VERONIX_MODEL_ID &&
      !freeTrial &&
      !freeSettingsLocked,
  );
  const sliderMin = paidDurationMode
    ? PAID_DURATION_MIN
    : durationBounds.min;
  const sliderMax = paidDurationMode
    ? PAID_DURATION_MAX
    : durationBounds.max;

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
    // Paid Veronix: default 5s. Slider goes 4 → 5 → … → 15.
    setDuration(
      model.id === VERONIX_MODEL_ID
        ? DEFAULT_PAID_DURATION_SECONDS
        : options.duration.default || options.duration.max,
    );
    if (model.id === VERONIX_MODEL_ID) {
      setResolution(options.resolutionDefault || "720p");
    } else if (options.resolutions.length) {
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

  // Assets → Edit: restore prompt + character images (+ optional start frame).
  useEffect(() => {
    const draft = readEditDraft();
    if (!draft) return;
    if (lockedMedia && draft.media !== lockedMedia) {
      // Still apply video drafts on video studio.
      if (lockedMedia !== "video") return;
    }
    setPrompt(draft.prompt || "");

    const chars = (draft.referenceImages || [])
      .filter((r) => r?.url)
      .slice(0, 4);
    if (chars.length) {
      setRefs(chars);
      setRefPreviews(chars.map((r) => r.url));
      setRefNames(
        chars.map((r) =>
          isCharacterName(r.label) ? normalizeCharacterName(r.label) : "",
        ),
      );
      // Keep start frame for composition only when no characters —
      // Seedance XOR would otherwise drop character refs.
      if (draft.startFrame?.url && chars.length === 0) {
        setStartFrame(draft.startFrame);
        setStartPreview(draft.startFrame.url);
      } else {
        setStartFrame(null);
        setStartPreview(null);
      }
      setStatus(
        `تم تحميل الوصف و${chars.length} شخصية للتعديل — عدّل ثم Generate`,
      );
    } else if (draft.startFrame?.url) {
      setStartFrame(draft.startFrame);
      setStartPreview(draft.startFrame.url);
      setRefs([]);
      setRefPreviews([]);
      setRefNames([]);
      setStatus("تم تحميل الوصف والإطار للتعديل — أضف شخصيات إن رغبت ثم Generate");
    } else {
      setStatus("تم تحميل الوصف للتعديل — عدّل ثم Generate");
    }
    clearEditDraft();
  }, [lockedMedia]);

  // Restore preview under Generate after navigating away (Home / Assets).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = readStoredPreview();
      let restoredRunning = false;

      if (stored && !cancelled) {
        const target =
          stored.preview.targetSeconds ||
          (media === "video" ? duration : 4);
        const etaMs = estimateGenerateSeconds(target) * 1000;
        const started = stored.genStartedAt ?? 0;
        const stale =
          stored.preview.status === "running" &&
          started > 0 &&
          Date.now() - started > etaMs + STALE_RUNNING_GRACE_MS;

        if (stale) {
          // Ghost "جاري الإنهاء…" after a dead multi-shot — clear it.
          writeStoredPreview(null, null);
        } else {
          setPreview(stored.preview);
          setGenStartedAt(stored.genStartedAt);
          if (stored.preview.status === "running") {
            restoredRunning = true;
            // Do NOT lock Generate — user can start another video.
            setStatus("توليد سابق يُتابع في Assets — يمكنك توليد فيديو جديد");
          }
        }
      }

      // Resume from a live Assets job, or clear a ghost running preview.
      if (user) {
        try {
          const { res, data } = await fetchJson<{
            assets?: Array<{
              id: string;
              url: string;
              mediaType: "image" | "video";
              historyId?: string;
              status: string;
              mode?: string;
              createdAt?: string;
              prompt?: string;
              targetSeconds?: number;
            }>;
          }>("/api/assets");
          if (!cancelled && res.ok) {
            const running = (data.assets || []).find(
              (a) =>
                a.status === "running" &&
                a.mediaType === (lockedMedia || media) &&
                a.mode !== "sequence-part",
            );
            if (running) {
              const targetSeconds = inferTargetSecondsFromAsset(running);
              const started = lockEtaStart(running.id, running.createdAt);
              setPreview({
                url: running.url || "",
                mediaType: running.mediaType,
                historyId: running.historyId,
                status: "running",
                assetId: running.id,
                targetSeconds,
              });
              setGenStartedAt(started);
              // Keep Generate unlocked for parallel jobs.
              setStatus("توليد قيد المتابعة في Assets — يمكنك توليد جديد");
              if (running.historyId || running.mediaType === "image") {
                const resumeId = ++genRunIdRef.current;
                void pollPreview(
                  running.historyId || "",
                  running.mediaType,
                  started,
                  false,
                  running.id,
                  resumeId,
                );
              }
            } else if (restoredRunning) {
              // Session said running but Assets has nothing — abandon ghost UI.
              setPreview(null);
              setGenStartedAt(null);
              setGenerating(false);
              setStatus(null);
              writeStoredPreview(null, null);
            }
          }
        } catch {
          // ignore
        }
      }
      if (!cancelled) setPreviewHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once per mount/user
  }, [user?.id, lockedMedia]);

  useEffect(() => {
    if (!previewHydrated) return;
    writeStoredPreview(preview, genStartedAt);
  }, [preview, genStartedAt, previewHydrated]);

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
    // Never reset the slider mid-generate (e.g. catalog refresh was wiping 32s → 8s).
    if (generating || preview?.status === "running") return;
    applyVideoModelDefaults(selectedModel);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply when model identity changes
  }, [media, selectedModelId, freeSettingsLocked, selectedModel?.mcpId, generating, preview?.status]);

  const countdownTargetSeconds =
    preview?.targetSeconds ||
    (media === "video"
      ? Math.min(sliderMax, Math.max(sliderMin, duration))
      : 1);
  const countdownMedia = media;
  const countdownOverdueSec =
    waitingResult && genStartedAt != null && remainingSec <= 0
      ? Math.max(
          0,
          Math.floor((Date.now() - genStartedAt) / 1000) -
            estimateGenerateSeconds(countdownTargetSeconds, countdownMedia),
        )
      : 0;
  const countdownLabel = formatStudioCountdownLabel({
    remainingSec,
    targetSeconds: countdownTargetSeconds,
    partCount: multiProgress?.partCount,
    shotCount: multiProgress?.shotCount,
    overdueForSec: countdownOverdueSec,
    media: countdownMedia,
  });

  useEffect(() => {
    if (!waitingResult || genStartedAt == null) {
      if (!waitingResult) {
        setRemainingSec(
          estimateGenerateSeconds(countdownTargetSeconds, countdownMedia),
        );
      }
      return;
    }
    const tick = () => {
      setRemainingSec(
        remainingGenerateSeconds(
          genStartedAt,
          countdownTargetSeconds,
          Date.now(),
          countdownMedia,
        ),
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [waitingResult, genStartedAt, countdownTargetSeconds, countdownMedia]);

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

      // Background catalog refresh (local/static only — no OpenArt).
      try {
        const { data } = await fetchJson<{
          image: CatalogModel[];
          video: CatalogModel[];
        }>("/api/models");
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
        const firstLive =
          imageModels.find((m) => m.id === VERONIX_IMAGE_MODEL_ID && m.available)?.id ||
          imageModels.find((m) => m.available)?.id ||
          VERONIX_IMAGE_MODEL_ID;
        setSelectedModelId(firstLive);
      }
      setAspectRatio((prev) => (IMAGE_ASPECTS.includes(prev as (typeof IMAGE_ASPECTS)[number]) ? prev : "1:1"));
      setResolution(DEFAULT_IMAGE_RESOLUTION);
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
            resolution:
              media === "video" ? resolution : resolution || DEFAULT_IMAGE_RESOLUTION,
            duration: media === "video" ? duration : undefined,
            generateAudio: media === "video" ? generateAudio : undefined,
            multiShot: false,
          }),
        });
        if (cancelled) return;
        if (!res.ok) {
          setCreditCost(null);
          setCreditLive(false);
          setFreeTrial(false);
          throw new Error(data.error || "تعذر جلب سعر الكريدت");
        }
        const isFree =
          Boolean(data.freeTrial) &&
          (user?.credits ?? 0) <= 0 &&
          !user?.freeVeronixUsed;
        setFreeTrial(isFree);
        const nextCost = data.totalCredits;

        if (cancelled) return;
        setShotHint(null);
        setCreditCost(nextCost);
        const quote = data.quotes?.[0];
        const live = Boolean(
          data.synced ||
            data.freeTrial ||
            data.totalCredits != null ||
            (quote?.available &&
              (quote.source === "cache" ||
                quote.source === "estimate" ||
                quote.source === "openart" ||
                quote.source === "openart-cache")),
        );
        setCreditLive(live);
        if (!live) {
          setQuoteError("تعذر حساب التكلفة — أعد المحاولة");
        } else {
          setQuoteError(null);
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

  async function fileToDataUrl(file: File): Promise<string> {
    const buf = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return `data:${file.type || "image/jpeg"};base64,${btoa(binary)}`;
  }

  /** Prefer local `/generations` URL; fall back to data URL so uploads always finish. */
  async function uploadFile(
    file: File,
    purpose: "create-image" | "create-video",
  ): Promise<VisualReference> {
    const localId = `local-ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const dataUrl = await fileToDataUrl(file);
    const localRef: VisualReference = {
      type: "image",
      id: localId,
      url: dataUrl,
      label: file.name || "reference",
    };

    const form = new FormData();
    form.append("file", file);
    form.append("purpose", purpose);
    form.append("label", file.name || "reference");

    try {
      const uploadPromise = fetchJson<{
        error?: string;
        visualReference?: VisualReference;
      }>("/api/upload", { method: "POST", body: form });
      const timeout = new Promise<"timeout">((resolve) => {
        window.setTimeout(() => resolve("timeout"), 12_000);
      });
      const raced = await Promise.race([uploadPromise, timeout]);
      if (raced === "timeout") return localRef;

      const { res, data } = raced;
      if (res.ok && data.visualReference?.url) {
        return data.visualReference;
      }
    } catch {
      // keep local
    }
    return localRef;
  }

  async function handleAddRefs(
    files: FileList | null,
    inputEl?: HTMLInputElement | null,
  ) {
    if (!files?.length) return;
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (inputEl) inputEl.value = "";
    if (!picked.length) return;

    setError(null);

    // How many slots are free right now (previews drive the UI).
    const freeSlots = Math.max(0, 4 - refPreviews.length);
    const batch = picked.slice(0, freeSlots);
    if (!batch.length) {
      setStatus("يمكنك رفع حتى 4 صور");
      return;
    }

    // Show every selected thumbnail immediately, then upload in parallel.
    const previews = batch.map((file) => URL.createObjectURL(file));
    const nextNames = [...refNames, ...batch.map(() => "")].slice(0, 4);
    setRefPreviews((prev) => [...prev, ...previews].slice(0, 4));
    setRefNames(nextNames);
    setStatus(
      batch.length === 1
        ? "جاري رفع الشخصية…"
        : `جاري رفع ${batch.length} شخصيات معاً…`,
    );

    const purpose = media === "image" ? "create-image" : "create-video";
    const settled = await Promise.all(
      batch.map(async (file, index) => {
        try {
          const ref = await uploadFile(file, purpose);
          return { index, preview: previews[index]!, ref };
        } catch (err) {
          return {
            index,
            preview: previews[index]!,
            ref: null as VisualReference | null,
            error: err instanceof Error ? err.message : "فشل رفع الصورة",
          };
        }
      }),
    );

    const uploaded = settled.filter((s) => s.ref);
    if (uploaded.length) {
      setRefs((prev) => {
        const next = [...prev];
        for (const item of uploaded) {
          if (!item.ref || next.length >= 4) continue;
          const name = normalizeCharacterName(nextNames[next.length] || "");
          next.push(name ? { ...item.ref, label: name } : item.ref);
        }
        return next;
      });
    }

    const failed = settled.filter((s) => !s.ref);
    if (failed.length) {
      const drop = new Set(failed.map((f) => f.preview));
      for (const f of failed) {
        if (f.preview.startsWith("blob:")) URL.revokeObjectURL(f.preview);
      }
      setRefPreviews((prev) => prev.filter((p) => !drop.has(p)));
      setRefNames((prev) => {
        const start = Math.max(0, prev.length - batch.length);
        return prev.filter((_, idx) => {
          if (idx < start) return true;
          const batchIdx = idx - start;
          return !drop.has(previews[batchIdx]!);
        });
      });
      setError(failed[0]?.error || "فشل رفع بعض الصور");
    }

    if (uploaded.length > 0) {
      setStatus(
        uploaded.length === 1
          ? "تم رفع الشخصية"
          : `تم رفع ${uploaded.length} شخصيات`,
      );
    } else if (!failed.length) {
      setStatus(null);
    }
  }

  async function handleFrame(
    file: File | undefined,
    which: "start" | "end",
    inputEl?: HTMLInputElement | null,
  ) {
    if (!file) return;
    if (inputEl) inputEl.value = "";
    setError(null);
    const preview = URL.createObjectURL(file);
    if (which === "start") setStartPreview(preview);
    else setEndPreview(preview);
    try {
      const ref = await uploadFile(file, "create-video");
      if (which === "start") setStartFrame(ref);
      else setEndFrame(ref);
      setStatus(which === "start" ? "تم رفع Start Frame" : "تم رفع End Frame");
    } catch (err) {
      if (which === "start") {
        setStartPreview(null);
        setStartFrame(null);
      } else {
        setEndPreview(null);
        setEndFrame(null);
      }
      URL.revokeObjectURL(preview);
      setError(err instanceof Error ? err.message : "فشل رفع الصورة");
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

  /** Prefer stable uploaded URLs for enhance — never block on blob→data conversion. */
  function collectEnhanceImageUrls(): string[] {
    const preferred: string[] = [];
    const fallbackData: string[] = [];
    const push = (url?: string | null) => {
      const u = url?.trim();
      if (!u) return;
      if (/^https?:\/\//i.test(u)) preferred.push(u);
      else if (u.startsWith("data:image/") && u.length <= 400_000) fallbackData.push(u);
    };
    push(startFrame?.url);
    push(endFrame?.url);
    for (const ref of refs) push(ref.url);
    return [...new Set([...preferred, ...fallbackData])].slice(0, 2);
  }

  async function handleEnhance() {
    if (!prompt.trim()) return;
    setEnhancing(true);
    setError(null);
    setStatus("جاري التحسين…");
    const controller = new AbortController();
    const kill = window.setTimeout(() => controller.abort(), 45_000);
    try {
      const uniqueUrls = collectEnhanceImageUrls();

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
        signal: controller.signal,
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
      // Full replace — English translate + AI polish (familiar flow).
      setPrompt(next);
      setPlannedShots(null);
      setShotHint(null);
      if (data.finalState) setPromptSceneState(data.finalState);

      if (data.needsVisionKey) {
        setStatus(
          "التحسين تم بدون قراءة ملابس الصورة — أضف OPENAI_API_KEY أو GEMINI_API_KEY على السيرفر لاستبدال الأنثى/الرجل بالمواصفات",
        );
      } else if (uniqueUrls.length && !data.visionUsed) {
        setStatus(
          "تم تحسين الوصف · ترجمة إنجليزية ثم AI Polish",
        );
      } else {
        const bits = ["تم تحسين الوصف"];
        if (data.visionUsed) bits.push("مع استبدال الشخصيات بمواصفات الصورة");
        if (data.chained) bits.push("وتسلسل من الحالة السابقة");
        bits.push("ترجمة إنجليزية ثم AI Polish");
        setStatus(bits.join(" · "));
      }
    } catch (err) {
      const aborted =
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && /abort/i.test(err.message));
      setError(
        aborted
          ? "انتهت مهلة التحسين — حاول مرة أخرى بدون صور كبيرة أو أعد المحاولة"
          : err instanceof Error
            ? err.message
            : "Enhance failed",
      );
      setStatus(null);
    } finally {
      window.clearTimeout(kill);
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
        `${label}… ${formatStudioCountdownLabel({
          remainingSec: remainingGenerateSeconds(
            startedAt,
            preview?.targetSeconds || countdownTargetSeconds,
          ),
          targetSeconds: preview?.targetSeconds || countdownTargetSeconds,
        })}`,
      );
      if (typeof data.pollAfterSeconds === "number" && data.pollAfterSeconds > 5) {
        await new Promise((r) => setTimeout(r, Math.min(data.pollAfterSeconds! * 1000, 20000)));
      }
    }
    throw new Error(
      `انتهت مهلة ${label} (~${Math.round((PREVIEW_POLL_ATTEMPTS * PREVIEW_POLL_MS) / 60000)} دقائق) — افتح Assets أو أعد التوليد`,
    );
  }

  async function pollPreview(
    historyId: string,
    mediaType: "image" | "video",
    startedAt: number,
    brandOutro: boolean,
    assetId?: string,
    runId?: number,
  ) {
    const stillMine = () =>
      runId == null || genRunIdRef.current === runId;
    for (let i = 0; i < PREVIEW_POLL_ATTEMPTS; i += 1) {
      await new Promise((r) => setTimeout(r, mediaType === "image" ? 2500 : PREVIEW_POLL_MS));
      if (!stillMine()) return;
      try {
        const statusQs = new URLSearchParams();
        if (historyId) statusQs.set("historyId", historyId);
        if (assetId) statusQs.set("assetId", assetId);
        if (!historyId && !assetId) return;
        const { res, data } = await fetchJson<{
          status?: string;
          urls?: string[];
          error?: string;
          note?: string;
          creditsRefunded?: boolean;
          pollAfterSeconds?: number;
        }>(`/api/status?${statusQs.toString()}`);
        if (!stillMine()) return;
        if (!res.ok) continue;
        const st = String(data.status || "").toUpperCase();
        const url = data.urls?.[0];
        if (url) {
          if (!stillMine()) return;
          if (brandOutro) {
            await applyBrandOutro({ url, historyId, assetId, mediaType });
          } else if (mediaType === "video") {
            setStatus("تحسين الوضوح والفلتر…");
            try {
              const graded = await finalizePaidVideo({ url, historyId, assetId });
              if (!stillMine()) return;
              setPreview({
                url: graded,
                mediaType,
                historyId,
                assetId,
                status: "completed",
              });
            } catch {
              if (!stillMine()) return;
              setPreview({ url, mediaType, historyId, assetId, status: "completed" });
            }
            setStatus(null);
          } else {
            setPreview({ url, mediaType, historyId, assetId, status: "completed" });
            setStatus(null);
          }
          setGenStartedAt(null);
          await onUserRefresh().catch(() => undefined);
          return;
        }
        if (st === "FAILED" || st === "CANCELLED") {
          if (!stillMine()) return;
          setPreview({ url: "", mediaType, historyId, assetId, status: "failed" });
          const failMsg =
            data.creditsRefunded || data.note
              ? data.error?.includes("تم استرجاع")
                ? data.error
                : `${data.error || "فشل التوليد"}\nفشل التوليد · تم استرجاع الكريديت`
              : data.error || "فشل التوليد";
          setError(failMsg);
          setGenStartedAt(null);
          await onUserRefresh().catch(() => undefined);
          return;
        }
        if (!stillMine()) return;
        setPreview((prev) => {
          if (
            prev?.assetId &&
            assetId &&
            prev.assetId !== assetId &&
            prev.status === "running"
          ) {
            return prev;
          }
          return prev
            ? {
                ...prev,
                status: "running",
                historyId: historyId || prev.historyId || undefined,
                assetId: assetId || prev.assetId,
              }
            : {
                url: "",
                mediaType,
                historyId: historyId || undefined,
                assetId,
                status: "running",
                targetSeconds: countdownTargetSeconds,
              };
        });
        setStatus(
          `جاري التوليد… ${formatStudioCountdownLabel({
            remainingSec: remainingGenerateSeconds(
              startedAt,
              preview?.targetSeconds || countdownTargetSeconds,
              Date.now(),
              mediaType,
            ),
            targetSeconds: preview?.targetSeconds || countdownTargetSeconds,
            media: mediaType,
          })}`,
        );
        if (typeof data.pollAfterSeconds === "number" && data.pollAfterSeconds > 2) {
          await new Promise((r) =>
            setTimeout(r, Math.min(data.pollAfterSeconds! * 1000, 20000)),
          );
        }
      } catch {
        // Keep waiting — tunnel blips should not abort a long Seedance job.
      }
    }
    if (!stillMine()) return;
    setStatus("ما زال التوليد جاريًا — افتح Assets لمتابعة النتيجة");
    await onUserRefresh().catch(() => undefined);
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
    if (!preview?.url && !preview?.historyId) {
      setShareNote("انتظر اكتمال الفيديو ثم حمّل");
      return;
    }
    if (preview.status === "running") {
      setShareNote("الفيديو ما زال يُولَّد — التحميل بعد الاكتمال");
      return;
    }
    setShareNote("جاري التحضير للتحميل…");
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
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || `download failed (${res.status})`);
      }
      const blob = await res.blob();
      if (!blob.size) throw new Error("empty file");
      const ext = preview.mediaType === "video" ? "mp4" : "png";
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `veronix-${Date.now()}.${ext}`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2_000);
      setShareNote("بدأ التحميل");
    } catch {
      // Navigate same-origin with attachment header (works when blob path fails on iOS).
      try {
        const a = document.createElement("a");
        a.href = path;
        a.download = `veronix-${Date.now()}.${preview.mediaType === "video" ? "mp4" : "png"}`;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setShareNote("بدأ التحميل");
      } catch {
        setShareNote("تعذر التحميل — افتح Assets وحاول من هناك");
      }
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
    referenceImages?: VisualReference[];
    count?: number;
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
        creditsRefunded?: number;
        note?: string;
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
        resolution:
          media === "video" ? resolution : resolution || DEFAULT_IMAGE_RESOLUTION,
        duration: media === "video" ? input.duration : undefined,
        generateAudio: media === "video" ? generateAudio : undefined,
        startFrame: input.startFrame ?? null,
        endFrame: input.endFrame ?? null,
        referenceImages: input.referenceImages ?? refs,
        waitForResult: false,
        sequencePart: Boolean(input.sequencePart),
        count: Math.min(4, Math.max(1, Math.floor(input.count || 1))),
      }),
    });
    return { res, data };
  }

  /**
   * Parse enhance script blocks:
   * لقطة 1:
   * <AI description…>
   *
   * لقطة 2:
   * …
   */
  function parseShotScriptLines(
    text: string,
  ): Array<{ prompt: string; action: string }> | null {
    const re =
      /(?:^|\n)\s*(?:لقطة|Shot)\s*(\d+)\s*[:：\-]\s*([\s\S]*?)(?=(?:\n\s*(?:لقطة|Shot)\s*\d+\s*[:：\-])|$)/gi;
    const shots: Array<{ prompt: string; action: string }> = [];
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) != null) {
      const body = (match[2] || "").trim();
      if (body.length < 3) continue;
      const firstLine = body.split(/\n/)[0]?.trim() || body;
      shots.push({
        action: firstLine.slice(0, 120),
        prompt: body,
      });
    }
    return shots.length >= 2 ? shots.slice(0, 8) : null;
  }

  async function gatherEnhanceImageUrls(): Promise<string[]> {
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
    return [...new Set(imageUrls)].slice(0, 2);
  }

  async function handleGenerate() {
    setGenFlash(true);
    window.setTimeout(() => setGenFlash(false), 220);
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
    const requestCount = freeTrial
      ? 1
      : Math.min(4, Math.max(1, Math.floor(outputCount) || 1));
    const billedCost = freeTrial ? 0 : (creditCost || 0) * requestCount;
    if (!freeTrial && (user.credits <= 0 || user.credits < billedCost)) {
      setError("رصيدك غير كافٍ. أضف كريدت أو رقِّ الباقة للمتابعة.");
      router.push("/pricing?paywall=1");
      return;
    }
    if (refPreviews.length > refs.length) {
      setError("انتظر اكتمال رفع الشخصيات ثم أعد التوليد.");
      return;
    }

    // New run id — previous in-flight generate keeps going in Assets but
    // stops updating this studio preview.
    const runId = ++genRunIdRef.current;
    const stillMine = () => genRunIdRef.current === runId;

    const startedAt = Date.now();
    const outputTargetSeconds =
      media === "video"
        ? Math.min(sliderMax, Math.max(sliderMin, duration))
        : 1;
    setGenerating(true);
    setGenStartedAt(startedAt);
    setRemainingSec(estimateGenerateSeconds(outputTargetSeconds, media));
    setMultiProgress(null);
    setPreview({
      url: "",
      mediaType: media,
      status: "running",
      targetSeconds: outputTargetSeconds,
    });
    // Paid Veronix: clear free-trial lock so the chosen 4–15s clip is billed.
    if (
      media === "video" &&
      selectedModelId === VERONIX_MODEL_ID &&
      ((user.credits ?? 0) > 0 || Boolean(user.freeVeronixUsed))
    ) {
      setFreeTrial(false);
      setMultiShotOn(false);
    }

    setStatus(
      freeTrial
        ? "جاري توليد فيديوك المجاني…"
        : requestCount > 1
          ? `جاري توليد ${requestCount} فيديوهات…`
          : "جاري التوليد…",
    );
    try {
      // Sync character names onto refs so BytePlus gets labeled @ImageN identity.
      const namedRefs = refs.map((r, i) => {
        const name = normalizeCharacterName(refNames[i] || "");
        return name ? { ...r, label: name } : r;
      });
      const linked = resolveCharacterRefsForPrompt(prompt.trim(), namedRefs);
      const activeRefs = linked.refs;
      // Client hint for binding only — modest wardrobe is applied server-side.
      const finalPrompt = appendCharacterLinkHint(
        prompt.trim(),
        linked.matched,
        activeRefs,
      );
      const mode =
        media === "image"
          ? activeRefs.length
            ? "image2image"
            : "text2image"
          : activeRefs.length || startFrame
            ? "image2video"
            : "text2video";

      const { res, data } = await createOneClip({
        prompt: finalPrompt,
        mode,
        duration,
        // Character refs win on the server (XOR). Keep startFrame only when no chars.
        startFrame: activeRefs.length ? null : startFrame,
        endFrame: activeRefs.length ? null : endFrame,
        referenceImages: activeRefs,
        count: requestCount,
      });

      if (!stillMine()) return;

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
        const msg =
          failed.note || (failed.creditsRefunded && failed.creditsRefunded > 0)
            ? failed.error.includes("تم استرجاع")
              ? failed.error
              : `${failed.error}\nفشل التوليد · تم استرجاع الكريديت`
            : failed.error;
        setError(msg);
        setGenStartedAt(null);
        return;
      }

      const okResults = (data.results || []).filter((r) => !r.error);
      const ok = okResults[0];
      const firstUrl = ok?.urls?.[0] || "";
      const historyId = ok?.historyId;
      const assetId = ok?.assetId;
      const brand = Boolean(data.freeTrial || ok?.needsBrandOutro);
      const resultRunning = String(ok?.status || "").toLowerCase() === "running";
      const extraCount = Math.max(0, okResults.length - 1);
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
            if (!stillMine()) return;
            setPreview({
              url: graded,
              mediaType: media,
              historyId,
              assetId,
              status: "completed",
            });
          } catch (gradeErr) {
            if (!stillMine()) return;
            setPreview({
              url: firstUrl,
              mediaType: media,
              historyId,
              assetId,
              status: "completed",
            });
            setError(
              gradeErr instanceof Error
                ? gradeErr.message
                : "تعذر تطبيق فلتر الوضوح — عُرض الفيديو الأصلي",
            );
          }
          setStatus(
            extraCount > 0
              ? `اكتمل فيديو — و${extraCount} أخرى في Assets`
              : null,
          );
        } else {
          setPreview({
            url: firstUrl,
            mediaType: media,
            historyId,
            assetId,
            status: "completed",
          });
          setStatus(
            extraCount > 0
              ? `اكتملت صورة — و${extraCount} أخرى في Assets`
              : null,
          );
        }
        setGenStartedAt(null);
      } else if (historyId || (assetId && (resultRunning || media === "image"))) {
        setPreview((prev) => ({
          url: "",
          mediaType: media,
          historyId,
          status: "running",
          assetId: assetId || prev?.assetId,
          targetSeconds: prev?.targetSeconds ?? outputTargetSeconds,
        }));
        if (assetId) {
          lockEtaStart(assetId, new Date(startedAt).toISOString());
        }
        setStatus(
          requestCount > 1
            ? `جاري توليد ${requestCount} فيديوهات… الباقي يظهر في Assets`
            : "جاري التوليد…",
        );
        void pollPreview(historyId || "", media, startedAt, brand, assetId, runId);
      } else {
        setStatus("تم إرسال الطلب — افتح Assets لمتابعة النتيجة");
        setGenStartedAt(null);
      }

      await onUserRefresh();
    } catch (err) {
      if (!stillMine()) return;
      setError(err instanceof Error ? err.message : "فشل التوليد");
      setGenStartedAt(null);
    } finally {
      if (stillMine()) setGenerating(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-3 pb-8 pt-4 sm:px-6" dir="rtl">
      {platformReady === false && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
          التوليد غير مُعدّ على السيرفر. يلزم ضبط{" "}
          <code className="rounded bg-black/30 px-1.5 py-0.5 text-[#22f0ff]">BYTEPLUS_API_KEY</code>{" "}
          ثم إعادة التشغيل.
        </div>
      )}

      {(error || status) && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm whitespace-pre-line ${
            error
              ? "border-rose-400/30 bg-rose-400/10 text-rose-100"
              : "border-cyan-400/25 bg-cyan-400/10 text-cyan-50"
          }`}
        >
          {error ?? status}
        </div>
      )}

      {media === "video" &&
        selectedModelId === VERONIX_MODEL_ID &&
        !user?.freeVeronixUsed &&
        (user?.credits ?? 0) <= 0 && (
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
        <p className="mb-1 text-sm font-medium text-white/80">
          رفع الشخصيات{" "}
          <span className="font-normal text-white/45">(اختياري)</span>
        </p>
        <p className="mb-3 text-[11px] leading-relaxed text-white/40">
          سمِّ كل شخصية ثم اذكر اسمها في الوصف مباشرة — مثل «محمد ذهب إلى الحديقة» بدون @.
        </p>
        <div className="flex flex-wrap gap-3">
          {refPreviews.map((src, i) => (
            <div
              key={`${src}-${i}`}
              className="w-[8.5rem] space-y-1.5 rounded-2xl border border-white/10 bg-black/25 p-1.5 sm:w-[9.5rem]"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-black/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={refNames[i] || `شخصية ${i + 1}`}
                  className="h-full w-full object-contain"
                />
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded-full bg-black/70 p-0.5"
                  onClick={() => {
                    setRefs((r) => r.filter((_, idx) => idx !== i));
                    setRefPreviews((r) => {
                      const doomed = r[i];
                      if (doomed?.startsWith("blob:")) URL.revokeObjectURL(doomed);
                      return r.filter((_, idx) => idx !== i);
                    });
                    setRefNames((n) => n.filter((_, idx) => idx !== i));
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <label className="block space-y-0.5" dir="rtl">
                <span className="block text-center text-[10px] font-semibold text-[#22f0ff]">
                  اسم الشخصية
                </span>
                <input
                  type="text"
                  value={refNames[i] || ""}
                  onChange={(e) => {
                    const value = normalizeCharacterName(e.target.value);
                    setRefNames((prev) => {
                      const next = [...prev];
                      while (next.length <= i) next.push("");
                      next[i] = value;
                      return next;
                    });
                    setRefs((prev) =>
                      prev.map((ref, idx) =>
                        idx === i
                          ? {
                              ...ref,
                              label: value || ref.label || "reference",
                            }
                          : ref,
                      ),
                    );
                  }}
                  placeholder="مثال: محمد"
                  className="w-full rounded-lg border border-[#22f0ff]/35 bg-black/50 px-1.5 py-1.5 text-center text-xs font-semibold text-white outline-none placeholder:font-normal placeholder:text-white/35 focus:border-[#22f0ff]"
                  maxLength={40}
                  autoComplete="off"
                />
              </label>
            </div>
          ))}
          {refPreviews.length < 4 && (
            <label className="flex aspect-[3/4] w-[8.5rem] cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-white/20 text-white/60 sm:w-[9.5rem]">
              <ImagePlus className="h-5 w-5" />
              <span className="text-[10px]">إضافة</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) =>
                  void handleAddRefs(e.target.files, e.target)
                }
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
                onChange={(e) =>
                  void handleFrame(e.target.files?.[0], slot.which, e.target)
                }
              />
            </label>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-[#141821] p-3">
        {linkedCharacters.length > 0 ? (
          <div className="mb-2 flex flex-wrap items-center gap-1.5" dir="rtl">
            <span className="text-[10px] text-white/40">تم الربط:</span>
            {linkedCharacters.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 rounded-full border border-[#22f0ff]/30 bg-[#22f0ff]/10 px-2 py-0.5 text-[11px] font-semibold text-[#22f0ff]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.url}
                  alt=""
                  className="h-4 w-4 rounded-full object-cover"
                />
                {normalizeCharacterName(c.label)}
              </span>
            ))}
          </div>
        ) : refNames.some((n) => isCharacterName(n)) ? (
          <p className="mb-2 text-[11px] text-white/35" dir="rtl">
            اكتب اسم الشخصية في الوصف للربط التلقائي — مثال: «محمد ذهب إلى الحديقة»
          </p>
        ) : null}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={5}
          placeholder={
            media === "image"
              ? "صف الصورة… يمكنك ذكر اسم الشخصية مباشرة"
              : "صف مشهد الفيديو… اذكر اسم الشخصية مثل: محمد ذهب إلى الحديقة"
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
              <span className="text-white/70">المدة</span>
              <span className="font-semibold tabular-nums text-[#22f0ff]">
                {Math.min(sliderMax, Math.max(sliderMin, duration))}ث
                {freeSettingsLocked ? " · مجاني أول مرة" : ""}
              </span>
            </div>
            <input
              type="range"
              min={sliderMin}
              max={sliderMax}
              step={1}
              value={Math.min(sliderMax, Math.max(sliderMin, duration))}
              disabled={freeSettingsLocked}
              onChange={(e) => {
                const raw = Math.round(Number(e.target.value));
                setDuration(
                  Math.min(sliderMax, Math.max(sliderMin, raw)),
                );
              }}
              className="w-full accent-[#22f0ff] disabled:opacity-60"
            />
            <div className="flex justify-between text-[10px] text-white/35">
              <span>{sliderMin}s</span>
              {selectedModelId === VERONIX_MODEL_ID &&
              !user?.freeVeronixUsed &&
              (user?.credits ?? 0) <= 0 ? (
                <span className="text-[#22f0ff]">تجربة مجانية</span>
              ) : (
                <span className="text-[#22f0ff]">
                  {paidDurationMode ? "4 → 15 ثانية" : `أقصى ${sliderMax}s`}
                </span>
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

      <div className="relative z-20 flex items-stretch gap-2" dir="rtl">
        {!freeTrial ? (
          <div
            className="flex shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border border-white/12 bg-[#141821] px-2.5 py-2"
            aria-label="عدد الفيديوهات"
          >
            <span className="text-[10px] font-semibold text-white/55">عدد</span>
            <div className="flex items-center gap-1">
              {([1, 2, 3, 4] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setOutputCount(n)}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold tabular-nums transition active:scale-95 ${
                    outputCount === n
                      ? "bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.25)]"
                      : "bg-white/8 text-white/70 hover:bg-white/12"
                  }`}
                  aria-pressed={outputCount === n}
                  aria-label={`${n} فيديو`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={quoting || !selectedModel?.available}
          className={`relative flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-5 py-4 text-base font-bold text-white transition duration-150 enabled:active:scale-[0.97] enabled:active:brightness-110 disabled:opacity-70 ${
            genFlash
              ? "scale-[0.98] brightness-110 ring-2 ring-white/45"
              : ""
          }`}
        >
          {quoting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Sparkles className="h-5 w-5" />
          )}
          {quoting
            ? "يحسب السعر…"
            : waitingResult || generating
              ? "توليد فيديو جديد"
              : freeTrial
                ? "Generate مجاني"
                : outputCount > 1
                  ? `Generate ×${outputCount}`
                  : "Generate"}
          <span className="rounded-full bg-black/20 px-2.5 py-0.5 text-xs tabular-nums">
            {quoting
              ? "…"
              : creditLive && creditCost != null
                ? freeTrial
                  ? "مجاني"
                  : `−${creditCost * (freeTrial ? 1 : outputCount)}`
                : "—"}
          </span>
        </button>
      </div>

      {(preview || waitingResult) && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#141821]">
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
            <p className="text-sm font-semibold text-white">معاينة النتيجة</p>
            {waitingResult && (
              <span className="inline-flex items-center gap-1 text-xs tabular-nums text-[#22f0ff]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                جاري التوليد · {countdownLabel}
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
                    <p className="text-lg font-semibold tracking-wide text-white">
                      جاري التوليد
                    </p>
                    <p className="max-w-sm px-4 text-center text-xl font-bold tabular-nums text-[#22f0ff] sm:text-2xl">
                      {countdownLabel}
                    </p>
                    <p className="px-6 text-center text-xs text-white/35">
                      {preview?.mediaType === "image" || media === "image"
                        ? "الصورة عادة جاهزة خلال ~30 ثانية — لا تغلق التطبيق"
                        : `فيديو ${countdownTargetSeconds}ث ≈ ${Math.ceil(
                            estimateGenerateSeconds(countdownTargetSeconds, "video") / 60,
                          )} دقائق خلف الكواليس — لا تغلق التطبيق`}
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
                <p className="mt-2 text-lg font-semibold text-white">جاري التوليد</p>
                <p className="mt-1 max-w-sm px-4 text-center text-xl font-bold tabular-nums text-[#22f0ff]">
                  {countdownLabel}
                </p>
              </div>
            )}
          </div>
          <div className="border-t border-white/8 px-4 py-2 text-center text-[11px] text-white/45">
            تم إنشاؤه بواسطة VYRONIX
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
              disabled={
                preview?.status === "running" ||
                (!preview?.url && !preview?.historyId)
              }
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

      {error && error.includes("تم استرجاع") ? (
        <div
          className="fixed inset-x-0 bottom-[4.75rem] z-[60] mx-auto w-[min(100%-1.5rem,28rem)] rounded-2xl border border-rose-400/35 bg-[#1a1014]/95 px-4 py-3 text-center text-sm font-semibold text-rose-50 shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur-md sm:bottom-24"
          dir="rtl"
          role="status"
        >
          فشل التوليد · تم استرجاع الكريديت
        </div>
      ) : null}

    </div>
  );
}
