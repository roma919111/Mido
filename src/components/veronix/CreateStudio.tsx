"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  startTransition,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  ChevronDown,
  ImagePlus,
  Loader2,
  Minus,
  Plus,
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
  isFreeVeronixEligible,
} from "@/lib/free-trial";
import { quoteCreditsLocal } from "@/lib/credit-quote-local";
import {
  buildVeronixShotScript,
  idealScriptSeconds,
  type VeronixShotScript,
} from "@/lib/veronix-shot-script";
import type { VisualReference } from "@/lib/types";
import type { SceneState } from "@/lib/prompt-enhance";
import { fetchJson } from "@/lib/fetch-json";
import {
  isCharacterName,
  matchNamedCharacters,
  normalizeCharacterName,
  resolveCharacterRefsForPrompt,
  stripInternalPromptNotes,
} from "@/lib/character-names";
import {
  estimateGenerateSeconds,
  inferTargetSecondsFromAsset,
  lockEtaStart,
  remainingGenerateSeconds,
  formatStudioCountdownLabel,
} from "@/lib/generate-eta";
import { veronixRefImageSrc } from "@/lib/media-proxy";
import {
  armEditDraftDismiss,
  clearEditDraft,
  clampEditDuration,
  dismissEditDraft,
  resolveEditBoot,
  type CreateEditDraft,
} from "@/lib/edit-draft";
import {
  newStudioClientId,
  patchJob,
  readStoredJobs,
  syncRunningJobsFromAssets,
  writeStoredJobs,
  type StudioJob,
} from "@/lib/studio-jobs";
import { StudioResultGrid } from "@/components/veronix/StudioResultGrid";
import { GenerateClock } from "@/components/veronix/GenerateClock";
import { useLocale } from "@/components/veronix/LocaleProvider";
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
/**
 * Hard wall-clock stop per generate job (real seconds from THIS Generate tap).
 * Seedance 4–15s clips commonly need several minutes — 180s was too short
 * and also falsely tripped on stale localStorage "running" cards.
 */
const MAX_GENERATE_WALL_MS = 10 * 60 * 1000;
/** Drop restored "running" jobs that outlived the job (no server progress). */
const STALE_RUNNING_GRACE_MS = 12 * 60 * 1000;
/** Deduplicate concurrent status pollers (hydrate + generate). */
const activePreviewPolls = new Set<string>();

const IMAGE_ASPECTS = ["1:1", "16:9", "9:16", "4:3", "3:4"] as const;
/** Seedance-supported video aspect ratios. */
const VIDEO_ASPECTS = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"] as const;

interface CreateStudioProps {
  user: CustomerUser | null;
  onUserRefresh: () => Promise<void>;
  /** Lock studio to one media type (dedicated create pages). */
  lockedMedia?: "image" | "video";
}

export function CreateStudio({ user, onUserRefresh, lockedMedia }: CreateStudioProps) {
  const router = useRouter();
  const { t, dir, locale } = useLocale();
  /** Assets → Edit: keep restored duration/ratio/clarity until the user changes model. */
  const restoreFromEditRef = useRef(false);
  /** `undefined` = not booted yet; `null` = no edit draft. */
  const editBootRef = useRef<CreateEditDraft | null | undefined>(undefined);
  if (editBootRef.current === undefined && typeof window !== "undefined") {
    let bootDraft = resolveEditBoot();
    if (
      bootDraft &&
      lockedMedia &&
      bootDraft.media &&
      bootDraft.media !== lockedMedia
    ) {
      dismissEditDraft();
      bootDraft = null;
    }
    editBootRef.current = bootDraft;
    if (bootDraft) restoreFromEditRef.current = true;
    else dismissEditDraft();
  }
  const boot = editBootRef.current ?? null;
  const bootChars = (boot?.referenceImages || [])
    .filter((r) => r?.url)
    .slice(0, 4);
  const bootStart =
    boot?.startFrame?.url && boot.useAsStartFrame && !bootChars.length
      ? boot.startFrame
      : null;

  const [media, setMedia] = useState<"image" | "video">(lockedMedia || "video");
  const [imageModels, setImageModels] = useState<CatalogModel[]>(IMAGE_MODELS);
  const [videoModels, setVideoModels] = useState<CatalogModel[]>(VIDEO_MODELS);
  const [selectedModelId, setSelectedModelId] = useState(
    lockedMedia === "image" ? VERONIX_IMAGE_MODEL_ID : VERONIX_MODEL_ID,
  );
  const [prompt, setPrompt] = useState(() =>
    boot?.prompt ? boot.prompt : "",
  );
  const [aspectRatio, setAspectRatio] = useState<string>(() => {
    if (
      boot?.aspectRatio &&
      (
        (lockedMedia === "image" ? IMAGE_ASPECTS : VIDEO_ASPECTS) as readonly string[]
      ).includes(boot.aspectRatio)
    ) {
      return boot.aspectRatio;
    }
    if (
      boot?.aspectRatio &&
      (VIDEO_ASPECTS as readonly string[]).includes(boot.aspectRatio)
    ) {
      return boot.aspectRatio;
    }
    return lockedMedia === "image" ? "1:1" : "16:9";
  });
  const [resolution, setResolution] = useState<string>(() => {
    if (boot?.resolution && ["480p", "720p"].includes(boot.resolution)) {
      return boot.resolution;
    }
    if (boot?.resolution && /^(1K|2K|4K)$/i.test(boot.resolution)) {
      return boot.resolution.toUpperCase();
    }
    return lockedMedia === "image" ? DEFAULT_IMAGE_RESOLUTION : FREE_VERONIX_RESOLUTION;
  });
  const [duration, setDuration] = useState<number>(() => {
    const d = clampEditDuration(boot?.duration);
    return d ?? FREE_VERONIX_DURATION_SECONDS;
  });
  const [generateAudio, setGenerateAudio] = useState(false);
  /** Free clean upscale (480→~720) — opt-in. */
  const [applyClarity, setApplyClarity] = useState(() =>
    typeof boot?.preferClarity === "boolean" ? boot.preferClarity : false,
  );
  const [refs, setRefs] = useState<VisualReference[]>(() =>
    bootStart ? [] : bootChars,
  );
  const [refPreviews, setRefPreviews] = useState<string[]>(() =>
    bootStart
      ? []
      : bootChars.map((r) => veronixRefImageSrc(r.url) || r.url),
  );
  /** Display names aligned with refPreviews / refs (no @ needed in prompt). */
  const [refNames, setRefNames] = useState<string[]>(() =>
    bootStart
      ? []
      : bootChars.map((r) =>
          isCharacterName(r.label) ? normalizeCharacterName(r.label) : "",
        ),
  );
  const [startFrame, setStartFrame] = useState<VisualReference | null>(() =>
    bootStart
      ? {
          ...bootStart,
          id: bootStart.id || `start-frame-boot`,
          label: bootStart.label || "start-frame",
        }
      : null,
  );
  const [endFrame, setEndFrame] = useState<VisualReference | null>(null);
  const [startPreview, setStartPreview] = useState<string | null>(() =>
    bootStart ? veronixRefImageSrc(bootStart.url) || bootStart.url : null,
  );
  const [endPreview, setEndPreview] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  /** Brief flash so a second Generate tap feels pressed. */
  const [genFlash, setGenFlash] = useState(false);
  /** How many videos to generate in one tap (1–4). Grid shows up to 3 per row. */
  const [outputCount, setOutputCount] = useState(1);
  /** Pre-generate Veronix shot-script recommendation sheet. */
  const [genConfirmOpen, setGenConfirmOpen] = useState(false);
  const [genConfirmLoading, setGenConfirmLoading] = useState(false);
  const [genConfirmScript, setGenConfirmScript] =
    useState<VeronixShotScript | null>(null);
  const [genConfirmOriginal, setGenConfirmOriginal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [platformReady, setPlatformReady] = useState<boolean | null>(null);
  const [jobs, setJobs] = useState<StudioJob[]>([]);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [genStartedAt, setGenStartedAt] = useState<number | null>(null);
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
  const preview = jobs[0] ?? null;
  const runningJobs = useMemo(
    () => jobs.filter((j) => j.status === "running"),
    [jobs],
  );
  const hasRunningJobs = runningJobs.length > 0;
  const waitingResult = generating || hasRunningJobs;
  /** Concurrent cap: at most 4 running videos total. */
  const MAX_CONCURRENT = 4;
  const slotsLeft = Math.max(0, MAX_CONCURRENT - runningJobs.length);
  /** Can start more while under the concurrent cap (1 running → up to 3 more). */
  const canStartMore = !generating && slotsLeft > 0;

  /** Poll/status updates are non-urgent — keep typing/buttons responsive. */
  const setJobsDeferred = useCallback((updater: SetStateAction<StudioJob[]>) => {
    startTransition(() => {
      setJobs(updater);
    });
  }, []);
  // Lock free-trial defaults only when we KNOW the customer has no credits yet.
  // While user is still loading (null), do NOT lock — that was wiping Edit duration to 4s.
  const freeSettingsLocked =
    Boolean(user) &&
    media === "video" &&
    selectedModelId === VERONIX_MODEL_ID &&
    !user?.freeVeronixUsed &&
    (user?.credits ?? 0) <= 0;

  /**
   * Instant price from seeded cost table — no /api/credits/quote while sliding.
   * Real wallet debit still happens only inside /api/generate.
   */
  const quoteMode =
    media === "image"
      ? refs.length
        ? "image2image"
        : "text2image"
      : startFrame || refs.length
        ? "image2video"
        : "text2video";
  const localQuote = useMemo(
    () =>
      quoteCreditsLocal({
        modelId: selectedModelId,
        media,
        mode: quoteMode,
        aspectRatio,
        resolution:
          media === "video" ? resolution : resolution || DEFAULT_IMAGE_RESOLUTION,
        duration: media === "video" ? duration : undefined,
        generateAudio: media === "video" ? generateAudio : undefined,
      }),
    [
      selectedModelId,
      media,
      quoteMode,
      aspectRatio,
      resolution,
      duration,
      generateAudio,
    ],
  );
  const freeTrial = isFreeVeronixEligible(user, {
    modelId: selectedModelId,
    media,
    duration,
    resolution,
    multiShot: false,
  });
  const creditCost = freeTrial ? 0 : localQuote.totalCredits;
  /** Exact count for this tap — never more than remaining slots. */
  const requestCountPreview = freeTrial
    ? 1
    : Math.min(Math.max(1, Math.min(4, outputCount)), Math.max(slotsLeft, 1));

  const linkedCharacters = useMemo(() => {
    // Match against typed names (refNames), not upload filenames on refs.
    const named = refs.map((r, i) => {
      const name = normalizeCharacterName(refNames[i] || "");
      return name ? { ...r, label: name } : r;
    });
    return matchNamedCharacters(prompt, named);
  }, [prompt, refs, refNames]);

  const allModels = useMemo(
    () => [...imageModels, ...videoModels],
    [imageModels, videoModels],
  );
  const selectedModel = allModels.find((m) => m.id === selectedModelId) ?? null;
  const durationBounds = durationBoundsForModel(selectedModel);
  const formOptions = formOptionsForModel(selectedModel);
  /** Paid Veronix: 480p / 720p only. */
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
    if (restoreFromEditRef.current) return;
    setAspectRatio("16:9");
    if (!model) return;
    const options = formOptionsForModel(model);
    const freeLocked =
      Boolean(user) &&
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

  // Assets → Edit: restore prompt + characters (+ re-assert duration after boot).
  useEffect(() => {
    const draft = editBootRef.current || resolveEditBoot();
    if (!draft) return;
    restoreFromEditRef.current = true;
    editBootRef.current = draft;

    if (draft.prompt) {
      setPrompt(stripInternalPromptNotes(draft.prompt || ""));
    }

    if (draft.media === "video" || lockedMedia === "video") {
      const restoredDuration = clampEditDuration(draft.duration);
      if (restoredDuration != null) setDuration(restoredDuration);
      if (draft.resolution && ["480p", "720p"].includes(draft.resolution)) {
        setResolution(draft.resolution);
      }
      if (
        draft.aspectRatio &&
        (VIDEO_ASPECTS as readonly string[]).includes(draft.aspectRatio)
      ) {
        setAspectRatio(draft.aspectRatio);
      }
      if (typeof draft.preferClarity === "boolean") {
        setApplyClarity(draft.preferClarity);
      }
    } else {
      if (
        draft.aspectRatio &&
        (IMAGE_ASPECTS as readonly string[]).includes(
          draft.aspectRatio as (typeof IMAGE_ASPECTS)[number],
        )
      ) {
        setAspectRatio(draft.aspectRatio);
      }
      if (draft.resolution && /^(1K|2K|4K)$/i.test(draft.resolution)) {
        setResolution(draft.resolution.toUpperCase());
      }
    }

    const chars = (draft.referenceImages || [])
      .filter((r) => r?.url)
      .slice(0, 4);
    if (chars.length) {
      setRefs(chars);
      setRefPreviews(
        chars.map((r) => veronixRefImageSrc(r.url) || r.url),
      );
      setRefNames(
        chars.map((r) =>
          isCharacterName(r.label) ? normalizeCharacterName(r.label) : "",
        ),
      );
      setStartFrame(null);
      setStartPreview(null);
      const missingNames = chars.filter(
        (r) => !isCharacterName(r.label),
      ).length;
      setStatus(
        missingNames
          ? `تم تحميل ${chars.length} صورة — سمِّ الشخصيات واذكر الأسماء في الوصف ثم Generate`
          : `تم تحميل إعدادات التعديل (${chars.length} شخصية) — راجع الوضوح/المدة/النسبة ثم Generate`,
      );
    } else if (draft.startFrame?.url && draft.useAsStartFrame) {
      const frame = draft.startFrame;
      const display = veronixRefImageSrc(frame.url) || frame.url;
      setStartFrame({
        ...frame,
        id: frame.id || `start-frame-${Date.now()}`,
        label: frame.label || "start-frame",
      });
      setStartPreview(display);
      setEndFrame(null);
      setEndPreview(null);
      setRefs([]);
      setRefPreviews([]);
      setRefNames([]);
      setStatus(
        "تم تحميل الصورة كأول إطار للفيديو — عدّل الوصف والمدة ثم Generate",
      );
    } else if (draft.startFrame?.url) {
      // Always map edit stills into character slots (never Start Frame).
      const frame = draft.startFrame;
      const display = veronixRefImageSrc(frame.url) || frame.url;
      setRefs([
        {
          ...frame,
          id: frame.id || `edit-char-${Date.now()}`,
          label: isCharacterName(frame.label) ? frame.label : "",
        },
      ]);
      setRefPreviews([display]);
      setRefNames([
        isCharacterName(frame.label) ? normalizeCharacterName(frame.label) : "",
      ]);
      setStartFrame(null);
      setStartPreview(null);
      setStatus(
        "تم تحميل صورة للتعديل في خانة الشخصيات — سمِّها واذكر الاسم في الوصف",
      );
    } else {
      setStatus("تم تحميل إعدادات التعديل — راجع الوضوح/المدة/النسبة ثم Generate");
    }
    clearEditDraft();
    // Strip edit query params so refresh does not re-apply forever.
    if (typeof window !== "undefined" && window.location.search.includes("edit=")) {
      const url = new URL(window.location.href);
      ["edit", "duration", "d", "resolution", "r", "aspect", "ar", "clarity", "c"].forEach(
        (k) => url.searchParams.delete(k),
      );
      const next = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "");
      window.history.replaceState({}, "", next);
    }
  }, [lockedMedia]);

  // Drop sticky Edit boot after leaving Create (delayed so Strict Mode remount keeps it).
  useEffect(() => {
    return () => {
      armEditDraftDismiss();
    };
  }, []);

  // Re-assert Edit duration after user finishes loading (user=null looked "free" and wiped slider).
  useEffect(() => {
    if (!user || !restoreFromEditRef.current) return;
    if (freeSettingsLocked) return;
    const bootDraft = editBootRef.current;
    const restored = clampEditDuration(bootDraft?.duration);
    if (restored != null) setDuration(restored);
    if (bootDraft?.resolution && ["480p", "720p"].includes(bootDraft.resolution)) {
      setResolution(bootDraft.resolution);
    }
    if (
      bootDraft?.aspectRatio &&
      (VIDEO_ASPECTS as readonly string[]).includes(bootDraft.aspectRatio)
    ) {
      setAspectRatio(bootDraft.aspectRatio);
    }
    if (typeof bootDraft?.preferClarity === "boolean") {
      setApplyClarity(bootDraft.preferClarity);
    }
  }, [user, freeSettingsLocked]);

  // Restore result cards under Generate after navigating away (Home / Assets).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = readStoredJobs().map((j) => {
        if (j.status !== "running") return j;
        const started = j.startedAt ?? 0;
        // Drop stale running ghosts — do NOT show a fake "180s timeout" card.
        if (started > 0 && Date.now() - started >= MAX_GENERATE_WALL_MS) {
          return null;
        }
        const target = j.targetSeconds || (media === "video" ? duration : 4);
        const etaMs = estimateGenerateSeconds(target, j.mediaType) * 1000;
        if (started > 0 && Date.now() - started > etaMs + STALE_RUNNING_GRACE_MS) {
          return null;
        }
        return j;
      }).filter((j): j is NonNullable<typeof j> => Boolean(j));

      if (!cancelled && stored.length) {
        setJobs(stored);
        const running = stored.find((j) => j.status === "running");
        if (running?.startedAt) setGenStartedAt(running.startedAt);
        if (running) {
          setStatus("توليد سابق يُتابع — يمكنك توليد المزيد ضمن حد 4");
        }
      }

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
              error?: string;
            }>;
          }>("/api/assets?sync=1");
          if (!cancelled && res.ok) {
            const assets = (data.assets || []).filter(
              (a) =>
                a.mediaType === (lockedMedia || media) &&
                a.mode !== "sequence-part",
            );
            const byId = new Map(assets.map((a) => [a.id, a]));

            setJobs((prev) => {
              let next = prev.map((j) => {
                if (!j.assetId && !j.historyId) return j;
                const a =
                  (j.assetId && byId.get(j.assetId)) ||
                  (j.historyId
                    ? assets.find(
                        (x) => x.historyId && x.historyId === j.historyId,
                      )
                    : undefined);
                if (!a) return j;
                const status =
                  a.status === "completed" ||
                  a.status === "failed" ||
                  a.status === "running"
                    ? (a.status as StudioJob["status"])
                    : j.status;
                return {
                  ...j,
                  url: a.url || j.url,
                  historyId: a.historyId || j.historyId,
                  assetId: a.id || j.assetId,
                  status,
                  error: a.error || j.error,
                  prompt: j.prompt || a.prompt || j.prompt,
                  targetSeconds:
                    j.targetSeconds || inferTargetSecondsFromAsset(a),
                  startedAt:
                    j.startedAt ||
                    (a.createdAt
                      ? lockEtaStart(a.id, a.createdAt)
                      : j.startedAt),
                };
              });

              const synced = syncRunningJobsFromAssets(next, assets, {
                mediaType: lockedMedia || media,
              });
              next = synced.jobs;
              for (const key of synced.clearedKeys) activePreviewPolls.delete(key);
              // Attach live running jobs that aren't already on the grid.
              for (const a of assets) {
                if (a.status !== "running") continue;
                if (next.some((j) => j.assetId === a.id)) continue;
                const started = lockEtaStart(a.id, a.createdAt);
                // Skip ancient server "running" ghosts — avoid false timeout cards.
                if (Date.now() - started >= MAX_GENERATE_WALL_MS) continue;
                next = [
                  {
                    clientId: newStudioClientId(),
                    url: a.url || "",
                    mediaType: a.mediaType,
                    historyId: a.historyId,
                    status: "running",
                    assetId: a.id,
                    targetSeconds: inferTargetSecondsFromAsset(a),
                    startedAt: started,
                  },
                  ...next,
                ];
              }
              return next.slice(0, 12);
            });

            // Resume polling for running jobs that have ids.
            const resumeTargets = assets.filter((a) => {
              if (a.status !== "running") return false;
              const started = lockEtaStart(a.id, a.createdAt);
              return Date.now() - started < MAX_GENERATE_WALL_MS;
            });
            for (const running of resumeTargets) {
              if (!(running.historyId || running.mediaType === "image")) continue;
              const started = lockEtaStart(running.id, running.createdAt);
              setGenStartedAt(started);
              setStatus("توليد قيد المتابعة — يمكنك توليد جديد");
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
    const t = window.setTimeout(() => writeStoredJobs(jobs), 1200);
    return () => window.clearTimeout(t);
  }, [jobs, previewHydrated]);

  // Keep +/- within remaining concurrent slots (e.g. 1 running → max selectable 3).
  useEffect(() => {
    if (slotsLeft <= 0) return;
    setOutputCount((n) => Math.min(Math.max(1, n), slotsLeft));
  }, [slotsLeft]);

  // Force-stop only jobs whose own startedAt (from THIS Generate tap) exceeded the wall limit.
  useEffect(() => {
    if (!runningJobs.length) return;
    const tick = () => {
      const now = Date.now();
      setJobsDeferred((prev) => {
        let changed = false;
        const next = prev.map((j) => {
          if (j.status !== "running") return j;
          const started = j.startedAt || 0;
          // Missing/corrupt start → don't fake a timeout; wait for poll/server.
          if (!(started > 0) || started > now) return j;
          if (now - started < MAX_GENERATE_WALL_MS) return j;
          changed = true;
          if (j.assetId) activePreviewPolls.delete(j.assetId);
          if (j.historyId) activePreviewPolls.delete(j.historyId);
          if (j.clientId) activePreviewPolls.delete(j.clientId);
          return {
            ...j,
            status: "failed" as const,
            error: "انتهت المهلة (10 دقائق) — تم إيقاف التوليد تلقائياً",
          };
        });
        return changed ? next : prev;
      });
    };
    tick();
    const id = window.setInterval(tick, 5000);
    return () => window.clearInterval(id);
  }, [runningJobs.length]);

  /**
   * If Assets already has the finished clip but Create is still "running"
   * (stale BytePlus poll / privacy-retry historyId), sync the grid from DB.
   */
  useEffect(() => {
    if (!user || !hasRunningJobs) return;
    let cancelled = false;

    const reconcile = async () => {
      try {
        const { res, data } = await fetchJson<{
          assets?: Array<{
            id: string;
            url: string;
            mediaType: "image" | "video";
            historyId?: string;
            status: string;
            mode?: string;
            error?: string;
            prompt?: string;
            createdAt?: string;
            targetSeconds?: number;
          }>;
        }>("/api/assets?sync=1");
        if (cancelled || !res.ok) return;
        const assets = data.assets || [];

        // Immediate setState so clocks drop as soon as Assets is done.
        setJobs((prev) => {
          const { jobs: next, changed, clearedKeys } = syncRunningJobsFromAssets(
            prev,
            assets,
            { mediaType: lockedMedia || media },
          );
          if (!changed) return prev;
          for (const key of clearedKeys) activePreviewPolls.delete(key);
          writeStoredJobs(next);
          if (!next.some((j) => j.status === "running")) {
            setGenerating(false);
            setGenStartedAt(null);
          }
          return next;
        });
      } catch {
        // ignore — next tick retries
      }
    };

    void reconcile();
    const id = window.setInterval(() => void reconcile(), 3_000);
    const onVis = () => {
      if (!document.hidden) void reconcile();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user?.id, hasRunningJobs, lockedMedia, media]);

  // Clear the big clock when nothing is actually running anymore.
  useEffect(() => {
    if (!hasRunningJobs && !generating) {
      setGenStartedAt(null);
      setStatus((s) =>
        s && /جاري التوليد|توليد قيد|توليد سابق/i.test(s) ? null : s,
      );
    }
  }, [hasRunningJobs, generating]);

  // Free first visit: lock Veronix defaults to 4s model / 480p (+ stock intro).
  useEffect(() => {
    if (!freeSettingsLocked) return;
    // Never wipe Assets → Edit restored duration/ratio.
    if (restoreFromEditRef.current) return;
    setDuration(FREE_VERONIX_DURATION_SECONDS);
    setResolution(FREE_VERONIX_RESOLUTION);
    setAspectRatio("16:9");
  }, [freeSettingsLocked]);

  // Paid / post-trial: select model → duration max + synced resolution/audio defaults.
  useEffect(() => {
    if (media !== "video" || !selectedModel || freeSettingsLocked) return;
    // Never reset the slider mid-generate (e.g. catalog refresh was wiping 32s → 8s).
    if (generating || hasRunningJobs) return;
    // Assets → Edit restored duration/ratio/clarity — do not wipe them.
    if (restoreFromEditRef.current) return;
    applyVideoModelDefaults(selectedModel);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply when model identity changes
  }, [
    media,
    selectedModelId,
    freeSettingsLocked,
    selectedModel?.mcpId,
    generating,
    hasRunningJobs,
  ]);

  // Drop legacy 1080p / 4K selections — Veronix only sells 480p / 720p.
  useEffect(() => {
    if (media !== "video" || freeSettingsLocked) return;
    if (!resolutionOptions.length) return;
    if (!resolutionOptions.includes(resolution)) {
      setResolution(
        formOptions.resolutionDefault || resolutionOptions[0] || "720p",
      );
    }
  }, [
    media,
    freeSettingsLocked,
    resolution,
    resolutionOptions,
    formOptions.resolutionDefault,
  ]);

  // Native 720p already meets the free upgrade target — never keep the checkbox on.
  useEffect(() => {
    if (media !== "video") return;
    if (String(resolution).toLowerCase() === "720p" && applyClarity) {
      setApplyClarity(false);
    }
  }, [media, resolution, applyClarity]);

  const countdownTargetSeconds =
    preview?.targetSeconds ||
    (media === "video"
      ? Math.min(sliderMax, Math.max(sliderMin, duration))
      : 1);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
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
      setAspectRatio((prev) =>
        IMAGE_ASPECTS.includes(prev as (typeof IMAGE_ASPECTS)[number]) ? prev : "1:1",
      );
      // Never wipe Assets → Edit restored image resolution (1K/2K/4K).
      if (!restoreFromEditRef.current) {
        setResolution(DEFAULT_IMAGE_RESOLUTION);
      }
    } else {
      const stillValid = videoModels.some((m) => m.id === selectedModelId && m.available);
      if (!stillValid) {
        const next =
          videoModels.find((m) => m.id === VERONIX_MODEL_ID && m.available) ||
          videoModels.find((m) => m.available) ||
          null;
        setSelectedModelId(next?.id || VERONIX_MODEL_ID);
        if (!restoreFromEditRef.current) applyVideoModelDefaults(next);
      }
      // Do not force 16:9 on catalog refresh — that wiped Edit-restored ratios.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply defaults only on media/catalog identity changes
  }, [media, imageModels, videoModels, selectedModelId, user?.freeVeronixUsed]);

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
    const freeSlots = Math.max(0, 4 - refs.length);
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
      // Full replace — cinematic polish in the customer's language.
      setPrompt(next);
      setPlannedShots(null);
      setShotHint(null);
      if (data.finalState) setPromptSceneState(data.finalState);

      // Recommend duration that fits unique actions once (no verb repeats).
      let recommendedSec: number | null = null;
      if (media === "video" && !freeSettingsLocked) {
        recommendedSec = idealScriptSeconds(next, {
          min: sliderMin,
          max: sliderMax,
        });
        setDuration(recommendedSec);
      }

      const arabicEnhanced = /[\u0600-\u06FF]/.test(next);
      if (data.needsVisionKey) {
        setStatus(
          arabicEnhanced
            ? "التحسين تم بالعربية بدون قراءة ملابس الصورة — أضف OPENAI_API_KEY أو GEMINI_API_KEY على السيرفر"
            : "التحسين تم بالإنجليزية بدون قراءة ملابس الصورة — أضف OPENAI_API_KEY أو GEMINI_API_KEY على السيرفر",
        );
      } else {
        const bits = [
          arabicEnhanced
            ? "تم تحسين الوصف بالعربية"
            : "تم تحسين الوصف بالإنجليزية",
        ];
        if (data.visionUsed) bits.push("مع مواصفات الشخصيات من الصورة");
        if (data.chained) bits.push("وتسلسل من الحالة السابقة");
        bits.push("مع محسنات الذكاء الاصطناعي");
        if (recommendedSec != null) {
          bits.push(`المدة المقترحة ${recommendedSec}ث بدون تكرار أفعال`);
        }
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

  /** Cache remotely; apply clarity grade only when the customer opted in. */
  async function finalizePaidVideo(input: {
    url: string;
    historyId?: string;
    assetId?: string;
  }): Promise<string> {
    if (!applyClarity) return input.url;
    // Native 720p already meets the free upgrade target — skip heavy re-encode
    // that was timing out status/cache and looking like "720p clarity fails".
    if (String(resolution).toLowerCase() === "720p") return input.url;
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
      console.warn("[veronix] clarity cache failed:", data.error || res.status);
      return input.url;
    }
    return data.url;
  }

  async function applyBrandOutro(input: {
    url: string;
    historyId?: string;
    assetId?: string;
    mediaType: "image" | "video";
    clientId?: string;
  }) {
    const match = {
      clientId: input.clientId,
      assetId: input.assetId,
      historyId: input.historyId,
    };
    if (input.mediaType !== "video") {
      setJobs((prev) =>
        patchJob(prev, match, {
          url: input.url,
          mediaType: input.mediaType,
          historyId: input.historyId,
          assetId: input.assetId,
          status: "completed",
          freeTrial: true,
        }),
      );
      return;
    }
    setStatus("جاري إضافة مقدمة Veronix…");
    setJobs((prev) =>
      patchJob(prev, match, {
        url: "",
        mediaType: "video",
        historyId: input.historyId,
        assetId: input.assetId,
        status: "running",
        freeTrial: true,
      }),
    );

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
        setJobs((prev) =>
          patchJob(prev, match, {
            url: data.url!,
            mediaType: "video",
            historyId: input.historyId,
            assetId: input.assetId,
            status: "completed",
            freeTrial: true,
          }),
        );
        setStatus(null);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error("تعذر تجهيز الفيديو");
        await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
      }
    }

    setJobs((prev) =>
      patchJob(prev, match, {
        url: "",
        mediaType: "video",
        historyId: input.historyId,
        assetId: input.assetId,
        status: "failed",
        freeTrial: true,
        error: lastError?.message || "تعذر عرض الفيديو بعد التوليد",
      }),
    );
    setError(lastError?.message || "تعذر عرض الفيديو بعد التوليد");
    setStatus(null);
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
    _runId?: number,
    clientId?: string,
  ) {
    const pollKey = assetId || historyId || clientId || "";
    if (!pollKey) return;
    if (activePreviewPolls.has(pollKey)) return;
    activePreviewPolls.add(pollKey);

    const match = { clientId, assetId, historyId: historyId || undefined };
    let liveHistoryId = historyId || "";

    const markCompleted = async (url: string, hid?: string) => {
      const finalHistoryId = hid || liveHistoryId || undefined;
      if (brandOutro) {
        await applyBrandOutro({
          url,
          historyId: finalHistoryId,
          assetId,
          mediaType,
          clientId,
        });
      } else if (mediaType === "video") {
        if (applyClarity) setStatus("ترقية الوضوح مجاناً…");
        try {
          const graded = await finalizePaidVideo({
            url,
            historyId: finalHistoryId,
            assetId,
          });
          setJobsDeferred((prev) =>
            patchJob(prev, match, {
              url: graded,
              mediaType,
              historyId: finalHistoryId,
              assetId,
              status: "completed",
            }),
          );
        } catch {
          setJobsDeferred((prev) =>
            patchJob(prev, match, {
              url,
              mediaType,
              historyId: finalHistoryId,
              assetId,
              status: "completed",
            }),
          );
        }
        setStatus(null);
      } else {
        setJobsDeferred((prev) =>
          patchJob(prev, match, {
            url,
            mediaType,
            historyId: finalHistoryId,
            assetId,
            status: "completed",
          }),
        );
        setStatus(null);
      }
      setGenStartedAt(null);
      await onUserRefresh().catch(() => undefined);
    };

    /** Prefer DB asset — Assets may finish before BytePlus poll returns a URL. */
    const tryAssetReady = async (): Promise<boolean> => {
      if (!assetId) return false;
      try {
        const { res, data } = await fetchJson<{
          status?: string;
          urls?: string[];
          error?: string;
          note?: string;
          creditsRefunded?: boolean;
        }>(`/api/status?assetId=${encodeURIComponent(assetId)}`);
        if (!res.ok) return false;
        const st = String(data.status || "").toUpperCase();
        const url = data.urls?.[0];
        if (url) {
          await markCompleted(url, liveHistoryId);
          return true;
        }
        if (st === "FAILED" || st === "CANCELLED") {
          const failMsg =
            data.creditsRefunded || data.note
              ? data.error?.includes("تم استرجاع")
                ? data.error
                : `${data.error || "فشل التوليد"}\nفشل التوليد · تم استرجاع الكريديت`
              : data.error || "فشل التوليد";
          setJobsDeferred((prev) =>
            patchJob(prev, match, {
              url: "",
              mediaType,
              historyId: liveHistoryId || undefined,
              assetId,
              status: "failed",
              error: failMsg,
            }),
          );
          setError(failMsg);
          setGenStartedAt(null);
          await onUserRefresh().catch(() => undefined);
          return true;
        }
      } catch {
        // ignore
      }
      return false;
    };

    try {
    for (let i = 0; i < PREVIEW_POLL_ATTEMPTS; i += 1) {
      if (Date.now() - startedAt >= MAX_GENERATE_WALL_MS) {
        setJobsDeferred((prev) =>
          patchJob(prev, match, {
            status: "failed",
            error: "انتهت المهلة (10 دقائق) — تم إيقاف التوليد تلقائياً",
          }),
        );
        setError("انتهت المهلة (10 دقائق) — تم إيقاف التوليد تلقائياً");
        setGenStartedAt(null);
        return;
      }
      await new Promise((r) => setTimeout(r, mediaType === "image" ? 2500 : PREVIEW_POLL_MS));
      try {
        // Every other tick: trust Assets/DB first (fixes "ready in Assets, spinning on Create").
        if (i % 2 === 0 && (await tryAssetReady())) return;

        const statusQs = new URLSearchParams();
        if (liveHistoryId) statusQs.set("historyId", liveHistoryId);
        else if (assetId) statusQs.set("assetId", assetId);
        if (!liveHistoryId && !assetId) return;
        const { res, data } = await fetchJson<{
          status?: string;
          urls?: string[];
          error?: string;
          note?: string;
          creditsRefunded?: boolean;
          pollAfterSeconds?: number;
          historyId?: string;
        }>(`/api/status?${statusQs.toString()}`);
        if (!res.ok) {
          if (await tryAssetReady()) return;
          continue;
        }
        const st = String(data.status || "").toUpperCase();
        const url = data.urls?.[0];
        if (url) {
          await markCompleted(url, liveHistoryId);
          return;
        }
        if (st === "FAILED" || st === "CANCELLED") {
          // BytePlus may fail an old historyId after privacy-retry; check DB asset first.
          if (await tryAssetReady()) return;
          const failMsg =
            data.creditsRefunded || data.note
              ? data.error?.includes("تم استرجاع")
                ? data.error
                : `${data.error || "فشل التوليد"}\nفشل التوليد · تم استرجاع الكريديت`
              : data.error || "فشل التوليد";
          setJobsDeferred((prev) =>
            patchJob(prev, match, {
              url: "",
              mediaType,
              historyId: liveHistoryId || undefined,
              assetId,
              status: "failed",
              error: failMsg,
            }),
          );
          setError(failMsg);
          setGenStartedAt(null);
          await onUserRefresh().catch(() => undefined);
          return;
        }
        // Avoid re-rendering the whole studio when nothing meaningful changed.
        setJobsDeferred((prev) => {
          const cur = prev.find(
            (j) =>
              (match.clientId && j.clientId === match.clientId) ||
              (match.assetId && j.assetId === match.assetId) ||
              (match.historyId && j.historyId === match.historyId),
          );
          // If a parallel reconciler already completed this card, stop polling.
          if (cur && cur.status === "completed" && cur.url) {
            return prev;
          }
          if (
            cur &&
            cur.status === "running" &&
            (cur.historyId || "") === (liveHistoryId || "") &&
            (cur.assetId || "") === (assetId || "")
          ) {
            // Pick up privacy-retry historyId written by Assets sync.
            if (cur.historyId && cur.historyId !== liveHistoryId) {
              liveHistoryId = cur.historyId;
            }
            return prev;
          }
          return patchJob(prev, match, {
            status: "running",
            historyId: liveHistoryId || undefined,
            assetId,
            mediaType,
            startedAt,
            targetSeconds: countdownTargetSeconds,
          });
        });
        if (typeof data.pollAfterSeconds === "number" && data.pollAfterSeconds > 2) {
          await new Promise((r) =>
            setTimeout(r, Math.min(data.pollAfterSeconds! * 1000, 12_000)),
          );
        }
      } catch {
        // Keep waiting — tunnel blips should not abort a long Seedance job.
      }
    }
    // Last chance: Assets often has the clip even when BytePlus poll timed out.
    if (await tryAssetReady()) return;
    setStatus("ما زال التوليد جاريًا — افتح Assets لمتابعة النتيجة");
    await onUserRefresh().catch(() => undefined);
    } finally {
      activePreviewPolls.delete(pollKey);
      if (liveHistoryId) activePreviewPolls.delete(liveHistoryId);
      if (assetId) activePreviewPolls.delete(assetId);
      if (clientId) activePreviewPolls.delete(clientId);
    }
  }

  async function handleShare(job?: StudioJob | null) {
    const target = job || preview;
    if (!target?.url) return;
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

  const handleShareJob = useCallback((job: StudioJob) => {
    void (async () => {
      if (!job.url) return;
      setShareNote(null);
      const shareUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/assets`
          : "/assets";
      const text = job.prompt || "Generated with Veronix.ai";
      try {
        if (navigator.share) {
          await navigator.share({
            title: "Veronix.ai",
            text,
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
    })();
  }, []);

  const handleDeleteJob = useCallback((job: StudioJob) => {
    setJobs((prev) => prev.filter((j) => j.clientId !== job.clientId));
  }, []);

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
        aspectRatio,
        resolution:
          media === "video" ? resolution : resolution || DEFAULT_IMAGE_RESOLUTION,
        duration: media === "video" ? input.duration : undefined,
        generateAudio: media === "video" ? generateAudio : undefined,
        clarity:
          media === "video"
            ? applyClarity && String(resolution).toLowerCase() !== "720p"
            : undefined,
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

  function validateGenerateReady(): boolean {
    if (!canStartMore) {
      setError(
        slotsLeft <= 0
          ? "لديك 4 فيديوهات قيد التوليد — انتظر انتهاء أحدها قبل توليد المزيد."
          : "التوليد جارٍ — انتظر لحظة ثم أعد المحاولة.",
      );
      return false;
    }
    if (!user) {
      router.push(`/signup?next=${encodeURIComponent("/")}&paywall=1`);
      return false;
    }
    if (!prompt.trim()) {
      setError("اكتب وصفًا أولًا.");
      return false;
    }
    if (!selectedModel?.available) {
      setError("هذا الموديل غير متاح للتوليد حاليًا. اختر موديلًا متاحًا.");
      return false;
    }
    const requestCount = freeTrial
      ? 1
      : Math.min(slotsLeft, Math.max(1, Math.min(4, Math.floor(outputCount) || 1)));
    if (requestCount < 1) {
      setError("لديك 4 فيديوهات قيد التوليد — انتظر انتهاء أحدها.");
      return false;
    }
    const billedCost = freeTrial ? 0 : creditCost * requestCount;
    if (!freeTrial && (user.credits <= 0 || user.credits < billedCost)) {
      setError("رصيدك غير كافٍ. أضف كريدت أو رقِّ الباقة للمتابعة.");
      router.push("/pricing?paywall=1");
      return false;
    }
    if (refPreviews.length > refs.length) {
      setError("انتظر اكتمال رفع الشخصيات ثم أعد التوليد.");
      return false;
    }
    return true;
  }

  /** Generate click → for video: instant local shot script + optional AI polish. */
  async function handleGenerate() {
    setGenFlash(true);
    window.setTimeout(() => setGenFlash(false), 220);
    setError(null);
    setStatus(null);
    setShareNote(null);
    if (!validateGenerateReady()) return;

    // Images: generate immediately with the customer's original prompt.
    if (media !== "video") {
      void runGenerateWithPrompt(prompt.trim());
      return;
    }

    const original = prompt.trim();
    setGenConfirmOriginal(original);

    // Instant local script — never block Generate on LLM / enhance network.
    const localScript = buildVeronixShotScript({
      originalPrompt: original,
      minSeconds: sliderMin,
      maxSeconds: sliderMax,
    });
    setGenConfirmScript(localScript);
    setGenConfirmOpen(true);
    setGenConfirmLoading(false);

    // Background AI polish (optional). Keep local script if it times out.
    const controller = new AbortController();
    const kill = window.setTimeout(() => controller.abort(), 18_000);
    try {
      setGenConfirmLoading(true);
      const { res: scriptRes, data: scriptData } = await fetchJson<{
        script?: VeronixShotScript;
        error?: string;
      }>("/api/shots/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          prompt: original,
          // Prompt may already be enhanced via «تحسين الوصف» — do not re-enhance here
          // (that double call was hanging the sheet and blocking video generate).
          enhancedPrompt: original,
          minSeconds: sliderMin,
          maxSeconds: sliderMax,
        }),
      });
      if (scriptRes.ok && scriptData.script?.scriptPrompt) {
        setGenConfirmScript(scriptData.script);
      }
    } catch {
      // Keep the instant local recommendation — user can still generate.
    } finally {
      window.clearTimeout(kill);
      setGenConfirmLoading(false);
    }
  }

  async function acceptVeronixRecommendation() {
    const script = genConfirmScript;
    if (!script?.scriptPrompt?.trim()) {
      setError("التوصية غير جاهزة — اختر البرومبت الأصلي أو أعد المحاولة.");
      return;
    }
    setGenConfirmOpen(false);
    setGenConfirmLoading(false);
    const sec = Math.min(
      sliderMax,
      Math.max(sliderMin, script.totalSeconds || duration),
    );
    setDuration(sec);
    setGenConfirmScript(null);
    try {
      await runGenerateWithPrompt(script.scriptPrompt, { durationSeconds: sec });
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل بدء التوليد");
    }
  }

  async function acceptOriginalPrompt() {
    const original = genConfirmOriginal || prompt.trim();
    setGenConfirmOpen(false);
    setGenConfirmLoading(false);
    setGenConfirmScript(null);
    // Original prompt at the customer's chosen slider duration.
    try {
      await runGenerateWithPrompt(original);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل بدء التوليد");
    }
  }

  function dismissGenerateConfirm() {
    setGenConfirmOpen(false);
    setGenConfirmLoading(false);
    setGenConfirmScript(null);
    setStatus(null);
  }

  async function runGenerateWithPrompt(
    promptForGenerate: string,
    opts?: { durationSeconds?: number },
  ) {
    if (!validateGenerateReady()) return;
    const userPrompt = prompt.trim();
    const finalUserPrompt = (promptForGenerate || userPrompt).trim();
    if (!finalUserPrompt) {
      setError("اكتب وصفًا أولًا.");
      return;
    }

    // Exact selection: 1→1, 2→2… capped only by remaining concurrent slots.
    const requestCount = freeTrial
      ? 1
      : Math.min(slotsLeft, Math.max(1, Math.min(4, Math.floor(outputCount) || 1)));

    // New run id — previous jobs keep polling independently by assetId.
    const runId = ++genRunIdRef.current;
    const stillMine = () => genRunIdRef.current === runId;

    const startedAt = Date.now();
    const outputTargetSeconds =
      media === "video"
        ? Math.min(
            sliderMax,
            Math.max(sliderMin, opts?.durationSeconds ?? duration),
          )
        : 1;
    const placeholders: StudioJob[] = Array.from({ length: requestCount }, () => ({
      clientId: newStudioClientId(),
      url: "",
      mediaType: media,
      status: "running" as const,
      targetSeconds: outputTargetSeconds,
      startedAt,
      prompt: userPrompt,
      startFrameUrl:
        media === "video" && startFrame?.url && !refs.length
          ? startFrame.url
          : media === "image" && startFrame?.url
            ? startFrame.url
            : undefined,
      referenceImages: refs.length
        ? refs.slice(0, 4).map((r, i) => ({
            type: "image" as const,
            id: r.id || `snap-ref-${i}`,
            url: r.url,
            label: normalizeCharacterName(refNames[i] || "") || r.label || "",
          }))
        : undefined,
      aspectRatio,
      resolution:
        media === "video" ? resolution : resolution || DEFAULT_IMAGE_RESOLUTION,
    }));
    setGenerating(true);
    setGenStartedAt(startedAt);
    setMultiProgress(null);
    // Append new cards — keep previous results on the grid.
    setJobs((prev) => [...placeholders, ...prev].slice(0, 12));
    setStatus(
      freeTrial
        ? "جاري توليد فيديوك المجاني…"
        : requestCount > 1
          ? `جاري توليد ${requestCount} فيديوهات…`
          : "جاري التوليد…",
    );

    // Yield to the browser so the clock + cards paint before the network call
    // (prevents Chrome main-thread freeze on Generate tap).
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.setTimeout(resolve, 0);
      });
    });
    if (!stillMine()) return;

    // Paid Veronix: clear free-trial lock so the chosen 4–15s clip is billed.
    if (
      media === "video" &&
      selectedModelId === VERONIX_MODEL_ID &&
      user &&
      ((user.credits ?? 0) > 0 || Boolean(user.freeVeronixUsed))
    ) {
      setMultiShotOn(false);
    }

    try {
      const namedRefs = refs.map((r, i) => {
        const name = normalizeCharacterName(refNames[i] || "");
        return name ? { ...r, label: name } : r;
      });
      const linked = resolveCharacterRefsForPrompt(userPrompt, namedRefs);
      const activeRefs = linked.refs;
      const finalPrompt = finalUserPrompt;
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
        duration: outputTargetSeconds,
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
      if (!res.ok) {
        setJobs((prev) =>
          prev.map((j) =>
            placeholders.some((p) => p.clientId === j.clientId)
              ? {
                  ...j,
                  status: "failed" as const,
                  error: data.error || "فشل التوليد",
                }
              : j,
          ),
        );
        throw new Error(data.error || "فشل التوليد");
      }

      const results = data.results || [];
      let anyRunning = false;
      let completedCount = 0;
      let failedCount = 0;

      for (let i = 0; i < Math.max(results.length, placeholders.length); i += 1) {
        const placeholder = placeholders[i];
        const result = results[i];
        if (!placeholder) continue;

        if (!result) {
          setJobs((prev) =>
            patchJob(
              prev,
              { clientId: placeholder.clientId },
              { status: "failed", error: "لم يُرجع السيرفر نتيجة لهذه الخانة" },
            ),
          );
          failedCount += 1;
          continue;
        }

        if (result.error) {
          const msg =
            result.note || (result.creditsRefunded && result.creditsRefunded > 0)
              ? result.error.includes("تم استرجاع")
                ? result.error
                : `${result.error}\nفشل التوليد · تم استرجاع الكريديت`
              : result.error;
          setJobs((prev) =>
            patchJob(
              prev,
              { clientId: placeholder.clientId },
              {
                status: "failed",
                error: msg,
                assetId: result.assetId,
                historyId: result.historyId,
              },
            ),
          );
          failedCount += 1;
          setError(msg);
          continue;
        }

        const firstUrl = result.urls?.[0] || "";
        const historyId = result.historyId;
        const assetId = result.assetId;
        const brand = Boolean(data.freeTrial || result.needsBrandOutro);
        const resultRunning =
          String(result.status || "").toLowerCase() === "running";

        if (assetId) {
          lockEtaStart(assetId, new Date(startedAt).toISOString());
        }

        if (firstUrl) {
          if (brand) {
            await applyBrandOutro({
              url: firstUrl,
              historyId,
              assetId,
              mediaType: media,
              clientId: placeholder.clientId,
            });
          } else if (media === "video") {
            let finalUrl = firstUrl;
            if (applyClarity) {
              setStatus("ترقية الوضوح مجاناً…");
              try {
                finalUrl = await finalizePaidVideo({
                  url: firstUrl,
                  historyId,
                  assetId,
                });
              } catch {
                // keep original
              }
            }
            if (!stillMine()) return;
            setJobs((prev) =>
              patchJob(
                prev,
                { clientId: placeholder.clientId },
                {
                  url: finalUrl,
                  mediaType: media,
                  historyId,
                  assetId,
                  status: "completed",
                },
              ),
            );
          } else {
            setJobs((prev) =>
              patchJob(
                prev,
                { clientId: placeholder.clientId },
                {
                  url: firstUrl,
                  mediaType: media,
                  historyId,
                  assetId,
                  status: "completed",
                },
              ),
            );
          }
          completedCount += 1;
        } else if (historyId || (assetId && (resultRunning || media === "image"))) {
          anyRunning = true;
          setJobs((prev) =>
            patchJob(
              prev,
              { clientId: placeholder.clientId },
              {
                url: "",
                mediaType: media,
                historyId,
                assetId,
                status: "running",
                targetSeconds: outputTargetSeconds,
                startedAt,
              },
            ),
          );
          void pollPreview(
            historyId || "",
            media,
            startedAt,
            brand,
            assetId,
            runId,
            placeholder.clientId,
          );
        } else {
          setJobs((prev) =>
            patchJob(
              prev,
              { clientId: placeholder.clientId },
              {
                status: "failed",
                error: "تعذر متابعة التوليد — افتح Assets",
                assetId,
                historyId,
              },
            ),
          );
          failedCount += 1;
        }
      }

      if (anyRunning) {
        setStatus(
          requestCount > 1
            ? `جاري توليد ${requestCount} فيديوهات…`
            : "جاري التوليد…",
        );
      } else if (completedCount > 0) {
        setStatus(
          completedCount > 1
            ? `اكتمل ${completedCount} ${media === "video" ? "فيديوهات" : "صور"}`
            : null,
        );
        setGenStartedAt(null);
      } else if (failedCount > 0) {
        setGenStartedAt(null);
      } else {
        setStatus("تم إرسال الطلب — افتح Assets لمتابعة النتيجة");
        setGenStartedAt(null);
      }

      await onUserRefresh();
    } catch (err) {
      if (!stillMine()) return;
      setError(err instanceof Error ? err.message : "فشل التوليد");
      setGenStartedAt(null);
      setJobs((prev) =>
        prev.map((j) =>
          placeholders.some((p) => p.clientId === j.clientId) &&
          j.status === "running"
            ? {
                ...j,
                status: "failed" as const,
                error: err instanceof Error ? err.message : "فشل التوليد",
              }
            : j,
        ),
      );
    } finally {
      if (stillMine()) setGenerating(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 px-4 pb-6 pt-3 sm:space-y-4 sm:px-6 sm:pb-8 sm:pt-4" dir={dir}>
      {platformReady === false && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
          التوليد غير مُعدّ على السيرفر. يلزم ضبط مفتاح Veronix لدى المسؤول ثم إعادة التشغيل.
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
            {t.create.freeTrialBanner}
          </div>
        )}

      {!lockedMedia && (
        <div className="flex gap-2">
          {(
            [
              { id: "image" as const, label: t.create.mediaImage },
              { id: "video" as const, label: t.create.mediaVideo },
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
        <div className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full border border-[#22f0ff]/25 bg-[#22f0ff]/10 px-2.5 py-1 text-[11px] font-semibold text-[#22f0ff] sm:gap-2 sm:px-3 sm:py-1.5 sm:text-xs">
          {lockedMedia === "video" ? t.create.studioVideo : t.create.studioImage}
          <span className="text-white/40">·</span>
          <span className="font-normal text-white/55">
            {lockedMedia === "video"
              ? t.create.modelsVideoOnly
              : t.create.modelsImageOnly}
          </span>
        </div>
      )}

      <label className="block rounded-2xl border border-white/10 bg-[#141821] px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="mb-1.5 flex items-center justify-between gap-2 sm:mb-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/40 sm:text-xs">{t.create.model}</p>
          <ChevronDown className="h-4 w-4 text-white/50" />
        </div>
        <select
          value={selectedModelId}
          onChange={(e) => {
            const id = e.target.value;
            restoreFromEditRef.current = false;
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
          className="w-full appearance-none rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none sm:py-2.5"
        >
          {(media === "image" ? imageModels : videoModels).map((model) => (
            <option
              key={model.id}
              value={model.id}
              disabled={!model.available}
            >
              {model.available
                ? model.name
                : `${model.name} · ${t.create.comingSoon}`}
            </option>
          ))}
        </select>
        {selectedModel?.id === VERONIX_MODEL_ID ||
        selectedModel?.id === "vyronix-image" ? (
          <p className="mt-2 text-xs text-white/45">{t.create.createdBy}</p>
        ) : selectedModel?.tagline ? (
          <p className="mt-2 text-xs text-white/45">{selectedModel.tagline}</p>
        ) : (
          <p className="mt-2 text-xs text-white/45">
            {locale === "en" ? "Pick one model only" : "اختيار موديل واحد فقط"}
          </p>
        )}
      </label>

      <div className="rounded-2xl border border-dashed border-white/15 bg-[#141821] p-3 sm:p-4">
        <p className="mb-1 text-sm font-medium text-white/80">
          {t.create.characters}{" "}
          <span className="font-normal text-white/45">{t.create.charactersOptional}</span>
        </p>
        <p className="mb-2.5 text-[11px] leading-relaxed text-white/40">
          {t.create.charactersHint}
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {refs.map((ref, i) => {
            const preview =
              veronixRefImageSrc(ref.url) ||
              refPreviews[i] ||
              ref.url;
            return (
            <div
              key={ref.id || `char-slot-${i}`}
              className="w-[6.75rem] shrink-0 space-y-1.5 rounded-2xl border border-white/10 bg-black/25 p-1.5 sm:w-[9.5rem]"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-[#1a1f2a]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt={refNames[i] || `شخصية ${i + 1}`}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    const el = e.currentTarget;
                    const fallbackUrl = veronixRefImageSrc(ref.url) || ref.url;
                    if (fallbackUrl && el.src !== fallbackUrl && !el.dataset.retried) {
                      el.dataset.retried = "1";
                      el.src = fallbackUrl;
                      return;
                    }
                    el.style.display = "none";
                    const fallback = el.nextElementSibling;
                    if (fallback instanceof HTMLElement) {
                      fallback.classList.remove("hidden");
                    }
                  }}
                />
                <div className="hidden absolute inset-0 flex flex-col items-center justify-center gap-1 px-2 text-center">
                  <span className="text-[10px] font-semibold text-rose-200">
                    {t.create.imageBroken}
                  </span>
                  <span className="text-[9px] text-white/45">{t.create.reupload}</span>
                </div>
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
              <label className="block space-y-0.5" dir={dir}>
                <span className="block text-center text-[10px] font-semibold text-[#22f0ff]">
                  {t.create.characterName}
                </span>
                <input
                  type="text"
                  value={refNames[i] || ""}
                  onChange={(e) => {
                    const value = normalizeCharacterName(e.target.value);
                    // Update name only — do NOT remount the card or rewrite refs here
                    // (labels are synced onto refs at Generate time).
                    setRefNames((prev) => {
                      const next = [...prev];
                      while (next.length <= i) next.push("");
                      next[i] = value;
                      return next;
                    });
                  }}
                  placeholder={t.create.characterNamePlaceholder}
                  className="w-full rounded-lg border border-[#22f0ff]/35 bg-black/50 px-1.5 py-1.5 text-center text-xs font-semibold text-white outline-none placeholder:font-normal placeholder:text-white/35 focus:border-[#22f0ff]"
                  maxLength={40}
                  autoComplete="off"
                />
              </label>
            </div>
            );
          })}
          {refs.length < 4 && (
            <label className="flex aspect-[3/4] w-[6.75rem] shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-white/20 text-white/60 sm:w-[9.5rem]">
              <ImagePlus className="h-5 w-5" />
              <span className="text-[10px]">{t.create.add}</span>
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
                  src={veronixRefImageSrc(c.url) || c.url}
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
          rows={4}
          placeholder={
            media === "image" ? t.create.promptImage : t.create.promptVideo
          }
          className="w-full resize-y bg-transparent text-[14px] leading-relaxed text-white outline-none placeholder:text-white/35 sm:text-[15px]"
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
            {enhancing ? t.create.enhancing : t.create.enhance}
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

      <div className="rounded-2xl border border-white/10 bg-[#141821] p-3 sm:p-4">
        <p className="mb-2.5 text-sm font-semibold text-white">Output</p>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <label className="space-y-1 text-xs text-white/50">
              {t.create.aspect}
            <select
              value={
                media === "video"
                  ? (VIDEO_ASPECTS as readonly string[]).includes(aspectRatio)
                    ? aspectRatio
                    : "16:9"
                  : aspectRatio
              }
              onChange={(e) => setAspectRatio(e.target.value)}
              disabled={freeSettingsLocked}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white disabled:opacity-60"
            >
              {(media === "video" ? VIDEO_ASPECTS : IMAGE_ASPECTS).map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          {media === "video" && resolutionOptions.length > 0 && (
            <label className="space-y-1 text-xs text-white/50">
              {t.create.clarity}
              <select
                value={
                  resolutionOptions.includes(resolution)
                    ? resolution
                    : formOptions.resolutionDefault || resolutionOptions[0]
                }
                onChange={(e) => {
                  const next = e.target.value;
                  setResolution(next);
                  // Free upgrade is 480→~720 only — never re-encode native 720p.
                  if (String(next).toLowerCase() === "720p") {
                    setApplyClarity(false);
                  }
                }}
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
              <span className="text-white/70">{t.create.duration}</span>
              <span className="font-semibold tabular-nums text-[#22f0ff]">
                {Math.min(sliderMax, Math.max(sliderMin, duration))}ث
                {freeSettingsLocked ? " · مجاني أول مرة" : ` · −${creditCost.toLocaleString("en-US")} كريدت`}
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
                {t.create.audio}
                {freeSettingsLocked ? (
                  <span className="text-[10px] text-white/40">(مفعّل في التجربة المجانية)</span>
                ) : null}
              </label>
            ) : (
              <p className="mt-2 text-xs text-white/40">
                لا يتوفر خيار صوت منفصل لهذا الموديل
              </p>
            )}
            {!freeSettingsLocked &&
            String(resolution).toLowerCase() !== "720p" ? (
              <label className="mt-2 flex items-center gap-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={applyClarity}
                  onChange={(e) => setApplyClarity(e.target.checked)}
                />
                {t.create.clarityUpgrade}
                <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-emerald-300/30">
                  {t.create.clarityFree}
                </span>
              </label>
            ) : !freeSettingsLocked ? (
              <p className="mt-2 text-xs text-white/40">
                {t.create.native720Note}
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div
        className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 -mx-4 flex items-stretch gap-2 border-t border-white/8 bg-[#0b0d12]/95 px-4 py-2.5 backdrop-blur-md sm:static sm:z-20 sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none"
        dir={dir}
      >
        {!freeTrial ? (
          <div
            className="flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-white/12 bg-[#141821] px-2 py-1.5 sm:gap-1 sm:px-2.5 sm:py-2"
            aria-label={t.create.outputCount}
          >
            <span className="text-[10px] font-semibold text-white/55">عدد</span>
            <div className="flex items-center gap-1 sm:gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setOutputCount((n) => Math.max(1, n - 1))
                }
                disabled={outputCount <= 1}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white transition active:scale-95 disabled:opacity-40 sm:h-9 sm:w-9"
                aria-label="إنقاص العدد"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-[1.5rem] text-center text-base font-black tabular-nums text-white sm:min-w-[1.75rem] sm:text-lg">
                {outputCount}
              </span>
              <button
                type="button"
                onClick={() =>
                  setOutputCount((n) =>
                    Math.min(Math.max(slotsLeft, 1), Math.min(4, n + 1)),
                  )
                }
                disabled={outputCount >= Math.min(4, Math.max(slotsLeft, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white transition active:scale-95 disabled:opacity-40 sm:h-9 sm:w-9"
                aria-label="زيادة العدد"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <span className="text-[9px] text-white/40">
              {slotsLeft < 4
                ? `متبقي ${slotsLeft} من 4`
                : "حد أقصى 4 معاً"}
            </span>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={
            !selectedModel?.available ||
            !canStartMore ||
            genConfirmOpen
          }
          className={`relative flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-3 py-3 text-sm font-bold text-white transition duration-150 enabled:active:scale-[0.97] enabled:active:brightness-110 disabled:opacity-70 sm:gap-2 sm:px-5 sm:py-4 sm:text-base ${
            genFlash
              ? "scale-[0.98] brightness-110 ring-2 ring-white/45"
              : ""
          }`}
        >
          {genConfirmOpen ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Sparkles className="h-5 w-5" />
          )}
          {genConfirmOpen
            ? "اختر من التوصية…"
            : !canStartMore
              ? slotsLeft <= 0
                ? "ممتلئ (4/4)"
                : "جاري الإرسال…"
              : freeTrial
                ? t.create.freeGenerate
                : requestCountPreview > 1
                  ? `Generate ×${requestCountPreview}`
                  : t.create.generate}
          <span className="rounded-full bg-black/20 px-2.5 py-0.5 text-xs tabular-nums">
            {freeTrial
              ? t.create.clarityFree
              : `−${creditCost * requestCountPreview}`}
          </span>
        </button>
      </div>

      {genConfirmOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/65 p-3 sm:items-center"
          dir="rtl"
          role="dialog"
          aria-modal="true"
          aria-label="توصية فيرونيكس"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/12 bg-[#12161f] shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
            <div className="border-b border-white/10 px-4 py-3">
              <p className="text-xs font-semibold tracking-[0.16em] text-[#22f0ff]/90">
                توصية فيرونيكس
              </p>
              <p className="mt-1 text-sm text-white/55">
                سكريبت لقطات بدون تكرار أفعال
                {genConfirmScript
                  ? ` · المدة المقترحة ${genConfirmScript.totalSeconds}ث`
                  : ""}
              </p>
            </div>
            <div className="max-h-[45vh] overflow-y-auto px-4 py-3">
              {!genConfirmScript ? (
                <div className="flex items-center gap-2 py-8 text-sm text-white/60">
                  <Loader2 className="h-4 w-4 animate-spin text-[#22f0ff]" />
                  جاري تجهيز التوصية…
                </div>
              ) : (
                <>
                  {genConfirmLoading ? (
                    <p className="mb-2 flex items-center gap-2 text-[11px] text-white/45">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#22f0ff]" />
                      جاري تحسين التوصية بالذكاء الاصطناعي (يمكنك التوليد الآن)
                    </p>
                  ) : null}
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-white/85">
                    {genConfirmScript.summaryAr}
                  </pre>
                </>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-white/40">
                أفعال من نصك فقط · كل لقطة تُحسَّن وحدها: فعل → اسم الفاعل → اسم المفعول به
                {" · "}
                توصية فيرونيكس / البرومبت الأصلي / إلغاء بدون توليد
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 border-t border-white/10 p-3 sm:grid-cols-3">
              <button
                type="button"
                disabled={!genConfirmScript || generating}
                onClick={() => void acceptVeronixRecommendation()}
                className="rounded-2xl bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-3 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                توصية فيرونيكس
              </button>
              <button
                type="button"
                disabled={generating || !genConfirmOriginal}
                onClick={() => void acceptOriginalPrompt()}
                className="rounded-2xl border border-[#22f0ff]/35 bg-[#22f0ff]/10 px-3 py-3 text-sm font-bold text-[#22f0ff] disabled:opacity-50"
              >
                البرومبت الأصلي
              </button>
              <button
                type="button"
                disabled={generating}
                onClick={() => dismissGenerateConfirm()}
                className="rounded-2xl border border-white/15 bg-white/5 px-3 py-3 text-sm font-bold text-white/85 disabled:opacity-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {waitingResult ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-[#22f0ff]/25 bg-[#141821] px-3 py-3">
          <GenerateClock
            startedAt={
              genStartedAt ||
              runningJobs[0]?.startedAt ||
              Date.now()
            }
            size="banner"
          />
          <p className="text-sm font-semibold text-white">
            جاري التوليد…
            {runningJobs.length > 0 ? ` (${runningJobs.length}/${MAX_CONCURRENT})` : ""}
          </p>
        </div>
      ) : null}

      <StudioResultGrid
        jobs={jobs}
        onShare={handleShareJob}
        onDelete={handleDeleteJob}
      />
      {shareNote ? (
        <p className="text-center text-xs text-[#22f0ff]">{shareNote}</p>
      ) : null}

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
