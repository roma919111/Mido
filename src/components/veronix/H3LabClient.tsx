"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronDown,
  ImagePlus,
  Languages,
  Loader2,
  Minus,
  Plus,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { AppHeader } from "@/components/veronix/AppHeader";
import { BottomNav } from "@/components/veronix/BottomNav";
import { CharacterLinkBanner } from "@/components/veronix/CharacterLinkBanner";
import { DeployStamp } from "@/components/veronix/DeployStamp";
import { GenerateClock } from "@/components/veronix/GenerateClock";
import { useLocale } from "@/components/veronix/LocaleProvider";
import { RentalDigitalClock } from "@/components/veronix/RentalDigitalClock";
import { StudioPrepClock } from "@/components/veronix/StudioPrepClock";
import { useLinkedCharacters } from "@/components/veronix/useLinkedCharacters";
import { VyronixIdBadge } from "@/components/veronix/VyronixIdBadge";
import { useCustomerUser } from "@/hooks/useCustomerUser";
import { isAdminUser } from "@/lib/admin-shared";
import {
  AI_RENTAL_STUDIO_NAME,
  AI_RENTAL_STUDIO_NAME_AR,
  STUDIO_RENTAL_DURATION_HOURS,
  STUDIO_RENTAL_PRICE_USD,
  STUDIO_RENTAL_PRICING_PATH,
  STUDIO_VIDEO_VARIANT_COUNT,
} from "@/lib/ai-rental-studio";
import { loginHref } from "@/lib/auth-next";
import {
  buildH3Smite79CharacterMemory,
  buildH3StudioCharacterBundle,
  isCharacterName,
  matchNamedCharacters,
  normalizeCharacterName,
  orderCharacterRefsForBinding,
  stripInternalPromptNotes,
} from "@/lib/character-names";
import { clearEditDraft } from "@/lib/edit-draft";
import { fetchJson } from "@/lib/fetch-json";
import {
  clearH3UiCache,
  clearStoredH3JobId,
  readH3ActiveJobIdFromCookie,
  readH3UiCache,
  readStoredH3JobId,
  resolveRentalEditBoot,
  storeH3JobId,
  writeH3UiCache,
  type H3VideoVariant,
  type RentalEngine,
} from "@/lib/h3-lab-client-storage";
import { hasArabic, isAcceptableLiteralEnglish } from "@/lib/h3-lab-prompt";
import { VERONIX_DEPLOYED_MODEL_ID } from "@/lib/ltx25-deployed";
import type { VisualReference } from "@/lib/types";

export type H3LabClientProps = {
  returnPath?: string;
  extraSection?: ReactNode;
  topSection?: ReactNode;
  linkSection?: ReactNode;
  hideHeroCard?: boolean;
  hideFloatingResultCard?: boolean;
  gpuOnly?: boolean;
  rentalEndsAt?: string;
  rentalStartedAt?: string;
  paidHourActive?: boolean;
  rentalGpuFailover?: boolean;
  rentalFrozen?: boolean;
  rentalPodReady?: boolean;
  rentalCanGenerate?: boolean;
  rentalVyronixId?: number;
  rentalPrepStartedAt?: string;
  needsVyronixLink?: boolean;
  studioUnlocked?: boolean;
  guestStudioPreview?: boolean;
};

type H3ActiveJob = {
  jobId?: string;
  status?: string;
  createdAt?: number;
};

/** GET /api/h3-lab/config */
type H3LabConfig = {
  configured?: boolean;
  label?: string;
  turboUsesSpace?: boolean;
  backend?: string;
  spaceBackend?: string;
  runpodReady?: boolean;
  gpuLinked?: boolean;
  gpuLive?: boolean;
  gpuOfflineReason?: string;
  gpuFailover?: boolean;
  rentalFrozen?: boolean;
  podReady?: boolean;
  podReachable?: boolean;
  modelsReady?: boolean;
  canGenerate?: boolean;
  maxParallel?: number;
  vyronixId?: number;
  prepStartedAt?: string;
  activeJob?: H3ActiveJob | null;
};

/** GET /api/h3-lab/status, /api/h3-lab/last job */
type H3JobStatus = {
  status?: string;
  progress?: string;
  info?: string;
  error?: string;
  submittedPrompt?: string;
  originalPrompt?: string;
  planOnly?: boolean;
  gpuLive?: boolean;
  playbackUrl?: string;
  resultUrl?: string;
  createdAt?: number;
  updatedAt?: number;
};

type H3GenerateResponse = {
  jobId?: string;
  error?: string;
  submittedPrompt?: string;
  originalPrompt?: string;
};

type H3UnlockResponse = {
  rentalGpuStop?: { rebootScheduled?: boolean };
};

type CharacterSlot = {
  id: string;
  file: File;
  preview: string;
  name: string;
  uploadPath?: string;
};

type FrameSlot = { file: File; preview: string };

type EnhanceMode = "literal" | "screenplay";

type DurationPlan = {
  targetTotalSeconds: number;
  promptForRunpod: string;
  perShotSeconds: number;
  beatCount: number;
  expectedTotalSeconds: number;
  expandedBeats: boolean;
};

const HF_SPACE_HOST = "minimaxai-minimax-h3-turbo-lora.hf.space";

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function spaceStreamUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (
      host !== HF_SPACE_HOST &&
      !host.endsWith(".hf.space") &&
      host !== "cdn-media.huggingface.co"
    ) {
      return null;
    }
    const params = new URLSearchParams({ u: toBase64Url(url.toString()) });
    return `/api/space/stream?${params.toString()}`;
  } catch {
    return null;
  }
}

function toPlayableUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/generations/")) {
    const params = new URLSearchParams({ local: trimmed, type: "video" });
    return `/api/media/stream?${params.toString()}`;
  }
  return spaceStreamUrl(trimmed) || trimmed;
}

function jobPlayableUrl(job: H3JobStatus): string {
  const playback = job.playbackUrl?.trim();
  if (playback) {
    return playback.startsWith("/api/media/stream") || playback.startsWith("/api/space/stream")
      ? playback
      : toPlayableUrl(playback);
  }
  const result = job.resultUrl?.trim();
  return result ? toPlayableUrl(result) : "";
}

function snapMegapixels(value: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(1, Math.max(0.1, 0.01 * Math.round(n / 0.01))) : 0.65;
}

const MEGAPIXEL_PRESETS = [0.5, 0.65, 1];

function clarityLabel(megapixels: number, aspect: string): string {
  const mp = snapMegapixels(megapixels);
  const parts = aspect.split(":").map((p) => Number(p.trim()));
  const rw = Number.isFinite(parts[0]) && parts[0] > 0 ? parts[0] : 16;
  const rh = Number.isFinite(parts[1]) && parts[1] > 0 ? parts[1] : 9;
  const pixels = 1e6 * Math.max(0.1, snapMegapixels(mp));
  const long = Math.max(
    32,
    32 * Math.round(Math.sqrt((pixels * Math.max(rw, rh)) / Math.min(rw, rh)) / 32),
  );
  const short = Math.max(32, 32 * Math.round(pixels / long / 32));
  const { width, height } =
    rw >= rh ? { width: long, height: short } : { width: short, height: long };
  const mpLabel = mp.toFixed(2).replace(/\.?0+$/, "") || "0";
  return `${mpLabel} MP · ${width}×${height}`;
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function countParagraphs(text: string): number {
  return Math.max(
    1,
    splitParagraphs(text.replace(/\r\n/g, "\n").replace(/\n+$/g, "").trim()).length,
  );
}

const SECONDS_HINT = /^\s*seconds\s*:/im;

function hasSecondsHint(text: string): boolean {
  return SECONDS_HINT.test(text);
}

/** Vyronix Auto: 15s per paragraph, up to 8 paragraphs. */
function planAutoDuration(
  text: string,
  opts?: { paragraphCount?: number; skipSceneAnchor?: boolean; skipSecondsHint?: boolean },
): DurationPlan {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n+$/g, "").trim();
  const beatCount = Math.min(8, Math.max(1, opts?.paragraphCount ?? countParagraphs(clean)));
  const paragraphs = splitParagraphs(clean).slice(0, beatCount);
  const perShot = 15;
  const shots = opts?.skipSecondsHint
    ? paragraphs.map((p) => p.trim()).filter(Boolean)
    : paragraphs.map((p) => (hasSecondsHint(p) ? p : `${p}\nseconds: ${perShot}`));
  const promptForRunpod =
    shots.length === 1
      ? shots[0]
      : opts?.skipSceneAnchor
        ? shots.join("\n\n")
        : `Consistent scene, characters, lighting, and camera style throughout.\n\n${shots.join("\n\n")}`;
  const total = Math.round(15 * beatCount * 10) / 10;
  return {
    targetTotalSeconds: total,
    promptForRunpod,
    perShotSeconds: 0,
    beatCount,
    expectedTotalSeconds: total,
    expandedBeats: false,
  };
}

/** Rental GPU without Auto: whole prompt is one shot. */
function planSingleShot(text: string, seconds: number): DurationPlan {
  const shotSeconds = Math.min(15, 120, Math.max(1, Number(seconds) || 120));
  const trimmed = text.trim();
  const flat = trimmed
    ? splitParagraphs(trimmed).join(" ").replace(/\s+/g, " ").trim()
    : "";
  const promptForRunpod =
    flat && !hasSecondsHint(flat) ? `${flat}\nseconds: ${shotSeconds}` : flat;
  return {
    targetTotalSeconds: shotSeconds,
    promptForRunpod,
    perShotSeconds: shotSeconds,
    beatCount: 1,
    expectedTotalSeconds: shotSeconds,
    expandedBeats: false,
  };
}

function appendShotSeconds(text: string, seconds: number): string {
  const perShot = Math.min(15, Math.max(1, Math.round(seconds)));
  const paragraphs = splitParagraphs(text);
  if (!paragraphs.length) return text;
  if (paragraphs.length === 1) {
    if (hasSecondsHint(paragraphs[0])) return text;
    paragraphs[0] = `${paragraphs[0]}\nseconds: ${perShot}`;
    return paragraphs.join("\n\n");
  }
  let changed = false;
  for (let i = 1; i < paragraphs.length; i += 1) {
    if (!hasSecondsHint(paragraphs[i])) {
      paragraphs[i] = `${paragraphs[i]}\nseconds: ${perShot}`;
      changed = true;
    }
  }
  return changed ? paragraphs.join("\n\n") : text;
}

/** H3 lab: first paragraph = scene anchor, each following paragraph = one shot. */
function planPerShot(text: string, seconds: number): DurationPlan {
  const perShot = Math.min(15, Math.max(1, Number(seconds) || 15));
  const paragraphs = splitParagraphs(text);
  const beatCount = paragraphs.length <= 1 ? 1 : Math.max(1, paragraphs.length - 1);
  const total = Math.round(perShot * beatCount * 10) / 10;
  return {
    targetTotalSeconds: total,
    promptForRunpod: appendShotSeconds(text, perShot),
    perShotSeconds: perShot,
    beatCount,
    expectedTotalSeconds: total,
    expandedBeats: false,
  };
}

function isGpuConnectivityError(code: string): boolean {
  const lower = code.toLowerCase();
  return (
    code === "gpu_required" ||
    code === "studio_rental_required" ||
    code === "studio_rental_expired" ||
    code === "studio_rental_provisioning" ||
    code === "vyronix_id_link_required" ||
    code === "studio_gpu_failover" ||
    lower.includes("gpu") ||
    lower.includes("cloudflare") ||
    lower.includes("r2") ||
    lower.includes("sync") ||
    lower.includes("pod failed") ||
    lower.includes("h3 pod") ||
    lower.includes("econnrefused") ||
    lower.includes("failed to connect") ||
    lower.includes("couldn't connect") ||
    lower.includes("network error") ||
    lower.includes("fetch failed") ||
    lower.includes("30–60") ||
    lower.includes("30-60") ||
    (lower.includes("loading") && lower.includes("weight"))
  );
}

function progressLabel(progress: string | undefined, ar: boolean, gpuOnly = false): string {
  if (!progress?.trim()) return ar ? "جاري التوليد…" : "Generating…";
  const lower = progress.toLowerCase();
  if (gpuOnly && isGpuConnectivityError(progress)) return ar ? "جاري التجهيز…" : "Preparing…";
  if (lower.includes("saving video")) return ar ? "حفظ الفيديو…" : "Saving video…";
  if (!gpuOnly && lower.includes("in gpu queue")) {
    return ar ? "في الطابور — انتظر…" : "In queue — please wait…";
  }
  if (!gpuOnly && (lower.includes("retry") || lower.includes("network error"))) {
    return ar ? "جاري المحاولة…" : "Retrying…";
  }
  return progress;
}

function errorLabel(error: string | undefined, ar: boolean, gpuOnly = false): string {
  if (!error?.trim()) return ar ? "فشل التوليد" : "Generation failed";
  if (error === "job_stale") {
    return ar
      ? "انقطع التوليد — حدّث الصفحة وحاول مرة ثانية"
      : "Generation interrupted — refresh and try again";
  }
  if (gpuOnly) {
    if (error === "studio_rental_expired") {
      return ar
        ? `انتهت ساعتَا التأجير — ادفع $${STUDIO_RENTAL_PRICE_USD} لتأجير جديد`
        : `Your ${STUDIO_RENTAL_DURATION_HOURS}-hour rental ended — pay $${STUDIO_RENTAL_PRICE_USD} to rent again`;
    }
    if (error === "studio_rental_provisioning" || error === "gpu_booting") {
      return ar
        ? "GPU يحمّل النماذج — وقت التجهيز مجاني. انتظر حتى «الاستوديو جاهز» (≈20–30 د أول مرة)"
        : "GPU loading models — prep is free. Wait for «Studio ready» (≈20–30 min first boot)";
    }
    if (error === "studio_gpu_failover") {
      return ar
        ? "السيرفر الحالي مشغول — جاري الانتقال لسيرفر بديل. انتظر قليلاً — الوقت لا يُخصم من تأجيرك"
        : "Current server busy — switching hosts. Please wait — rental time is not deducted";
    }
    if (error === "studio_rental_required") {
      return ar
        ? `تحتاج تأجير ${STUDIO_RENTAL_DURATION_HOURS} ساعة — ادفع $${STUDIO_RENTAL_PRICE_USD} للبدء`
        : `Rent ${STUDIO_RENTAL_DURATION_HOURS} hours ($${STUDIO_RENTAL_PRICE_USD}) to rent`;
    }
    if (error === "vyronix_id_link_required") {
      return ar
        ? "أدخل فيرونيكس ID أعلاه واضغط ربط قبل التوليد"
        : "Enter your Vyronix ID above and link before generating";
    }
    if (error === "character_refs_unavailable") {
      return ar
        ? "تعذّر تحميل صور الشخصيات — أعد اختيار الصور وحاول مرة أخرى"
        : "Could not load character images — re-select photos and try again";
    }
    if (error === "gpu_required") {
      return ar ? "GPU غير متصل — حدّث الصفحة" : "GPU not connected — refresh the page";
    }
    if (error === "gpu_offline") {
      return ar
        ? "توقف GPU عن التوليد — اضغط «إيقاف» ثم Generate من جديد"
        : "GPU stopped generating — press Stop, then Generate again";
    }
    if (isGpuConnectivityError(error)) {
      return ar
        ? "GPU غير جاهز بعد — انتظر دقيقتين ثم حاول"
        : "GPU not ready yet — wait a couple of minutes and retry";
    }
  }
  if (isGpuConnectivityError(error)) {
    return ar ? "GPU غير متصل — حدّث الصفحة" : "GPU not connected — refresh the page";
  }
  const lower = error.toLowerCase();
  if (lower.includes("out of memory") || lower.includes("oom")) {
    return ar
      ? "الذاكرة ممتلئة — جرّب دارافت أو وصفاً أقصر"
      : "Out of memory — try Draft mode or a shorter prompt";
  }
  if (lower.includes("timed out") || lower.includes("timeout")) {
    return ar
      ? "انتهت مهلة التوليد — جرّب مدة أقصر أو كرّر المحاولة"
      : "Generation timed out — try a shorter duration or retry";
  }
  return error;
}

const QUALITY_PRESETS = {
  fast: {
    megapixels: 0.5,
    steps: 6,
    duration: 5,
    labelAr: "فاست",
    labelEn: "Fast",
    hintAr: "6 خطوات · وضوح 0.5 MP",
    hintEn: "6 steps · 0.5 MP clarity",
  },
  standard: {
    megapixels: 0.65,
    steps: 8,
    duration: 5,
    labelAr: "ستاندرد",
    labelEn: "Standard",
    hintAr: "8 خطوات · وضوح 0.65 MP",
    hintEn: "8 steps · 0.65 MP clarity",
  },
  full: {
    megapixels: 1,
    steps: 28,
    duration: 8,
    labelAr: "فول",
    labelEn: "Full",
    hintAr: "28 خطوة · وضوح 1 MP",
    hintEn: "28 steps · 1 MP clarity",
  },
} as const;

type SpeedMode = keyof typeof QUALITY_PRESETS;

const SPEED_MODES = Object.keys(QUALITY_PRESETS) as SpeedMode[];

const SPACE_LABELS = {
  ar: {
    startFrame: "الإطار الأول",
    endFrame: "الإطار الأخير",
    charactersLinked: "الشخصيات المربوطة",
  },
  en: {
    startFrame: "Start frame",
    endFrame: "End frame",
    charactersLinked: "Linked characters",
  },
} as const;

function RentalVideoModelPicker({
  value,
  onChange,
  ltxAvailable = true,
  vyronixAvailable = true,
  spaceBackendLabel = "HF Turbo",
  ar = false,
}: {
  value: RentalEngine;
  onChange: (engine: RentalEngine) => void;
  ltxAvailable?: boolean;
  vyronixAvailable?: boolean;
  spaceBackendLabel?: string;
  ar?: boolean;
}) {
  const vyronixLabel = `VYRONIX Fast · ${spaceBackendLabel}`;
  return (
    <div className="rounded-2xl border border-[#22f0ff]/35 bg-[#141821] p-3 sm:p-4">
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#22f0ff]">
          {ar ? "موديل الفيديو" : "Video model"}
        </span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as RentalEngine)}
          className="mt-2 w-full rounded-xl border border-white/12 bg-[#0f1218] px-3 py-3 text-sm font-semibold text-white outline-none ring-[#22f0ff]/40 focus:ring-2"
        >
          <option value="ltx" disabled={!ltxAvailable}>
            LTX · HF Space (multi-subject)
          </option>
          <option value="vyronix" disabled={!vyronixAvailable}>
            {vyronixLabel}
          </option>
        </select>
      </label>
      <p className="mt-2 text-[11px] leading-relaxed text-white/45">
        {value === "ltx"
          ? ar
            ? "مخرجات LTX فقط: دقة Space · مدة 1–8 ث · subjects · Scene image"
            : "LTX outputs only: Space resolution · 1–8s · subjects · scene image"
          : ar
            ? "مخرجات VYRONIX GPU فقط: شخصيات · إطارات · مدة · Generate — كما كان"
            : "VYRONIX GPU outputs only: characters · frames · duration · Generate — unchanged"}
      </p>
    </div>
  );
}

const RentalLtxStudio = dynamic(
  () => import("@/components/veronix/CreateStudio").then((m) => ({ default: m.CreateStudio })),
  {
    loading: () => (
      <div className="flex justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-[#22f0ff]/80" />
      </div>
    ),
  },
);

const ASPECT_RATIOS = ["16:9", "9:16", "4:3", "3:4", "1:1", "21:9", "9:21"];
const RENTAL_ASPECT_STORAGE_KEY = "vyronix-rental-aspect";

async function uploadH3File(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const { res, data } = await fetchJson<{ path?: string; error?: unknown }>(
    "/api/h3-lab/upload",
    { method: "POST", credentials: "include", body: form },
  );
  if (!res.ok || !data?.path) {
    throw new Error(typeof data?.error === "string" ? data.error : "Upload failed");
  }
  return data.path;
}

function ElapsedDial({
  elapsedMs,
  elapsedSec,
  active,
}: {
  elapsedMs: number;
  elapsedSec: number;
  active: boolean;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 40);
    return () => window.clearInterval(id);
  }, [active]);

  const secondAngle = (elapsedSec % 60) * 6;
  const totalSec = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const tenths = Math.floor((elapsedMs % 1000) / 100);

  return (
    <div className="flex flex-col items-center gap-3 py-1">
      <div className="relative">
        <svg
          viewBox="0 0 100 100"
          className="h-[5.5rem] w-[5.5rem] drop-shadow-[0_0_18px_rgba(34,240,255,0.35)]"
          aria-hidden
        >
          <circle cx="50" cy="50" r="46" fill="#0d1118" stroke="rgba(34,240,255,0.35)" strokeWidth="2" />
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (30 * i * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={50 + 38 * Math.sin(angle)}
                y1={50 - 38 * Math.cos(angle)}
                x2={50 + 44 * Math.sin(angle)}
                y2={50 - 44 * Math.cos(angle)}
                stroke="rgba(255,255,255,0.35)"
                strokeWidth={i % 3 === 0 ? 2 : 1}
                strokeLinecap="round"
              />
            );
          })}
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="30"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="2.5"
            strokeLinecap="round"
            transform={`rotate(${((elapsedSec % 3600) / 3600) * 360 + secondAngle / 12} 50 50)`}
          />
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="22"
            stroke="#7c5cff"
            strokeWidth="2"
            strokeLinecap="round"
            transform={`rotate(${secondAngle} 50 50)`}
          />
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="16"
            stroke="#22f0ff"
            strokeWidth="1.5"
            strokeLinecap="round"
            transform={`rotate(${(24 * tick) % 360} 50 50)`}
          />
          <circle cx="50" cy="50" r="3.5" fill="#22f0ff" />
        </svg>
      </div>
      <span className="font-mono text-2xl font-bold tabular-nums tracking-wider text-[#22f0ff]">
        {`${minutes}:${String(totalSec % 60).padStart(2, "0")}.${tenths}`}
      </span>
    </div>
  );
}

function isRetryableStatus(res: Response): boolean {
  return res.status === 404 || res.status === 401 || res.status === 503;
}

export function H3LabClient({
  returnPath = "/h3-lab",
  extraSection,
  topSection,
  linkSection,
  hideHeroCard = false,
  hideFloatingResultCard = false,
  gpuOnly = false,
  rentalEndsAt,
  rentalStartedAt,
  paidHourActive = false,
  rentalGpuFailover = false,
  rentalFrozen = false,
  rentalPodReady = false,
  rentalCanGenerate = false,
  rentalVyronixId,
  rentalPrepStartedAt,
  needsVyronixLink = false,
  studioUnlocked = false,
  guestStudioPreview = false,
}: H3LabClientProps) {
  const { locale, dir, t } = useLocale();
  const ar = locale === "ar";
  const spaceLabels = ar ? SPACE_LABELS.ar : SPACE_LABELS.en;
  const { user, logout, ready, refreshing, refreshUser } = useCustomerUser();

  const [engine, setEngine] = useState<RentalEngine>(() =>
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("engine") === "vyronix"
      ? "vyronix"
      : "ltx",
  );
  const editBootAppliedRef = useRef(false);
  const [config, setConfig] = useState<H3LabConfig | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [characterNotes, setCharacterNotes] = useState("");
  const [characters, setCharacters] = useState<CharacterSlot[]>([]);
  const [aspectRatio, setAspectRatio] = useState(() => {
    if (!gpuOnly || typeof window === "undefined") return "9:16";
    const saved = sessionStorage.getItem(RENTAL_ASPECT_STORAGE_KEY)?.trim();
    return saved && ASPECT_RATIOS.includes(saved) ? saved : "9:16";
  });
  const [autoDuration, setAutoDuration] = useState(gpuOnly);
  const maxShotSeconds = autoDuration ? 120 : 15;
  const defaultShotSeconds = gpuOnly ? QUALITY_PRESETS.standard.duration : 15;
  const [shotSeconds, setShotSeconds] = useState<number>(defaultShotSeconds);
  const [megapixels, setMegapixels] = useState(0.65);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [speedMode, setSpeedMode] = useState<SpeedMode>("standard");
  const [seed, setSeed] = useState(42);
  const [lora, setLora] = useState("larry");
  const [planOnly, setPlanOnly] = useState(false);
  const [startFrame, setStartFrame] = useState<FrameSlot | null>(null);
  const [endFrame, setEndFrame] = useState<FrameSlot | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [info, setInfo] = useState("");
  const [submittedPrompt, setSubmittedPrompt] = useState("");
  const [originalPrompt, setOriginalPrompt] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [variants, setVariants] = useState<H3VideoVariant[]>([]);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [outputCount, setOutputCount] = useState(1);
  const [error, setError] = useState("");
  const [enhancing, setEnhancing] = useState(false);
  const [enhanceMode, setEnhanceMode] = useState<EnhanceMode | null>(null);
  const [enhanceNote, setEnhanceNote] = useState("");
  const [generating, setGenerating] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [gpuRebooting, setGpuRebooting] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const elapsedTimerRef = useRef<number | null>(null);
  const pollTimeoutRef = useRef<number | null>(null);
  const pollingActiveRef = useRef(false);
  const submittingRef = useRef(false);
  const pollFailuresRef = useRef(0);
  const activeJobRef = useRef<string | null>(null);
  const variantTimersRef = useRef(new Map<string, number>());
  const variantJobIndexRef = useRef(new Map<string, number>());
  const hydratedRef = useRef(false);
  const pollJobRef = useRef<(jobId: string) => Promise<void>>(async () => {});
  const pollVariantRef = useRef<(index: number, jobId: string) => Promise<void>>(
    async () => {},
  );

  const characterNames = useMemo(() => characters.map((c) => c.name), [characters]);
  const characterRefs = useMemo<VisualReference[]>(
    () =>
      characters.map((c) => ({ type: "image", id: c.id, url: c.preview, label: c.name })),
    [characters],
  );
  const { linkedCharacters, linkedIds } = useLinkedCharacters(
    prompt,
    characterRefs,
    characterNames,
  );
  const isAdmin = isAdminUser(user);
  const namedCharacters = useMemo(
    () => characters.filter((c) => isCharacterName(c.name)),
    [characters],
  );

  const insertCharacterName = useCallback((raw: string) => {
    const name = normalizeCharacterName(raw);
    if (!name) return;
    setPrompt((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return name;
      return matchNamedCharacters(trimmed, [{ id: "probe", type: "image", url: "", label: name }])
        .length > 0
        ? prev
        : `${trimmed} ${name}`;
    });
  }, []);

  const startElapsed = useCallback((startedAt?: number) => {
    const start = startedAt ?? Date.now();
    setElapsedMs(Math.max(0, Date.now() - start));
    if (elapsedTimerRef.current) window.clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = window.setInterval(
      () => setElapsedMs(Math.max(0, Date.now() - start)),
      100,
    );
  }, []);

  const stopElapsed = useCallback(() => {
    if (elapsedTimerRef.current) {
      window.clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }, []);

  const clearVariantTimers = useCallback(() => {
    variantTimersRef.current.forEach((id) => window.clearTimeout(id));
    variantTimersRef.current.clear();
    variantJobIndexRef.current.clear();
  }, []);

  const stopPolling = useCallback(() => {
    pollingActiveRef.current = false;
    activeJobRef.current = null;
    clearVariantTimers();
    if (pollTimeoutRef.current !== null) {
      window.clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, [clearVariantTimers]);

  const resetGeneration = useCallback(() => {
    stopPolling();
    stopElapsed();
    setProgress("");
    setJobId(null);
    setGenerating(false);
    submittingRef.current = false;
    activeJobRef.current = null;
    pollFailuresRef.current = 0;
    clearStoredH3JobId();
  }, [stopPolling, stopElapsed]);

  const finalizeVariants = useCallback(
    (list: H3VideoVariant[]) => {
      if (!list.every((v) => v.status === "complete" || v.status === "error")) return;
      stopPolling();
      stopElapsed();
      setGenerating(false);
      submittingRef.current = false;
      const done = list.filter((v) => v.status === "complete" && v.videoUrl);
      if (done.length > 0) {
        setVideoUrl(done[0].videoUrl ?? null);
        setSelectedVariantIndex(done[0].index);
      }
      const failed = list.filter((v) => v.status === "error").length;
      if (failed === list.length) {
        setError(ar ? "فشل توليد كل الخيارات — جرّب مرة أخرى" : "All variants failed — try again");
      } else if (failed > 0) {
        setInfo(
          ar
            ? `${done.length} من ${list.length} جاهزة — بعض الخيارات فشلت`
            : `${done.length} of ${list.length} ready — some variants failed`,
        );
      }
    },
    [ar, stopPolling, stopElapsed],
  );

  const resumeJob = useCallback(
    (id: string, startedAt?: number) => {
      setJobId(id);
      setGenerating(true);
      setError("");
      pollingActiveRef.current = true;
      activeJobRef.current = id;
      pollFailuresRef.current = 0;
      storeH3JobId(id);
      startElapsed(startedAt);
      void pollJobRef.current(id);
    },
    [startElapsed],
  );

  const elapsedSec = Math.floor(elapsedMs / 1000);

  const handlePollFailure = useCallback(
    async (id: string, res: Response) => {
      pollFailuresRef.current += 1;
      setProgress(ar ? "جاري متابعة التوليد…" : "Still generating…");
      if (pollFailuresRef.current >= 12) {
        resetGeneration();
        setError(ar ? "توقف التتبع — جرّب توليد جديد" : "Tracking stopped — try again");
        return;
      }
      if (isRetryableStatus(res)) {
        pollTimeoutRef.current = window.setTimeout(() => {
          void pollJobRef.current(id);
        }, 5000);
        return;
      }
      setError(ar ? "فشل التحقق من الحالة" : "Status check failed");
      resetGeneration();
    },
    [ar, resetGeneration],
  );

  const applyJobStatus = useCallback(
    (job: H3JobStatus): "complete" | "error" | "active" => {
      setProgress(progressLabel(job.progress, ar, gpuOnly));
      if (job.status === "complete") {
        setInfo(job.info || "");
        setSubmittedPrompt(job.submittedPrompt || "");
        setOriginalPrompt(job.originalPrompt || "");
        if (job.planOnly) {
          setVideoUrl(null);
        } else {
          const url = jobPlayableUrl(job);
          if (url) setVideoUrl(url);
        }
        resetGeneration();
        return "complete";
      }
      if (job.status === "error") {
        if (job.error === "job_stale") clearStoredH3JobId();
        setError(errorLabel(job.error, ar, gpuOnly));
        resetGeneration();
        return "error";
      }
      if (job.gpuLive === false) {
        setError(errorLabel("gpu_offline", ar, gpuOnly));
        resetGeneration();
        return "error";
      }
      return "active";
    },
    [ar, gpuOnly, resetGeneration],
  );

  const pollJob = useCallback(
    async (id: string) => {
      if (!pollingActiveRef.current) return;
      let res: Response;
      let data: H3JobStatus;
      try {
        ({ res, data } = await fetchJson<H3JobStatus>(
          `/api/h3-lab/status?jobId=${encodeURIComponent(id)}${gpuOnly ? "&gpu_only=1" : ""}`,
          { credentials: "include" },
        ));
      } catch {
        if (!pollingActiveRef.current) return;
        pollTimeoutRef.current = window.setTimeout(() => {
          void pollJob(id);
        }, 5000);
        return;
      }
      if (!pollingActiveRef.current) return;
      if (!res.ok || !data) {
        if (isRetryableStatus(res)) {
          await handlePollFailure(id, res);
          return;
        }
        setError(ar ? "فشل التحقق من الحالة" : "Status check failed");
        resetGeneration();
        return;
      }
      pollFailuresRef.current = 0;
      if (applyJobStatus(data) === "active") {
        pollTimeoutRef.current = window.setTimeout(() => {
          void pollJob(id);
        }, 3500);
      }
    },
    [ar, gpuOnly, applyJobStatus, handlePollFailure, resetGeneration],
  );
  pollJobRef.current = pollJob;

  const pollVariant = useCallback(
    async (index: number, id: string) => {
      if (!pollingActiveRef.current) return;
      let res: Response;
      let data: H3JobStatus;
      try {
        ({ res, data } = await fetchJson<H3JobStatus>(
          `/api/h3-lab/status?jobId=${encodeURIComponent(id)}&gpu_only=1`,
          { credentials: "include" },
        ));
      } catch {
        if (!pollingActiveRef.current) return;
        const timer = window.setTimeout(() => {
          void pollVariantRef.current(index, id);
        }, 5000);
        variantTimersRef.current.set(id, timer);
        return;
      }
      if (!pollingActiveRef.current) return;

      const failVariant = (message: string) => {
        setVariants((prev) => {
          const next = prev.map((v) =>
            v.index === index ? { ...v, status: "error" as const, error: message } : v,
          );
          finalizeVariants(next);
          return next;
        });
      };

      if (!res.ok || !data) {
        if (isRetryableStatus(res)) {
          pollFailuresRef.current += 1;
          if (pollFailuresRef.current >= 12) {
            failVariant(ar ? "توقف التتبع" : "Tracking stopped");
            return;
          }
          const timer = window.setTimeout(() => {
            void pollVariantRef.current(index, id);
          }, 5000);
          variantTimersRef.current.set(id, timer);
          return;
        }
        failVariant(ar ? "فشل التحقق من الحالة" : "Status check failed");
        return;
      }

      pollFailuresRef.current = 0;
      if (data.gpuLive === false) {
        const message = errorLabel("gpu_offline", ar, gpuOnly);
        setError(message);
        failVariant(message);
        return;
      }

      if (data.status === "complete") {
        if (data.submittedPrompt?.trim()) setSubmittedPrompt(data.submittedPrompt.trim());
        if (data.originalPrompt?.trim()) setOriginalPrompt(data.originalPrompt.trim());
        else if (prompt.trim()) setOriginalPrompt(prompt.trim());
        if (data.info?.trim()) setInfo(data.info.trim());
        const url = data.planOnly ? "" : jobPlayableUrl(data);
        setVariants((prev) => {
          const next = prev.map((v) =>
            v.index === index
              ? { ...v, status: "complete" as const, videoUrl: url || undefined, progress: undefined }
              : v,
          );
          const firstReady = next.find((v) => v.status === "complete" && v.videoUrl);
          if (firstReady?.videoUrl) {
            setVideoUrl((cur) => cur || firstReady.videoUrl || null);
            setSelectedVariantIndex((cur) =>
              next.some((v) => v.index === cur && v.videoUrl) ? cur : firstReady.index,
            );
          }
          const settled = next.filter((v) => v.status === "complete" || v.status === "error").length;
          setInfo(
            ar
              ? `${settled}/${next.length} جاهزة — يمكنك مشاهدة أي فيديو اكتمل`
              : `${settled}/${next.length} ready — watch any finished video`,
          );
          finalizeVariants(next);
          return next;
        });
        return;
      }

      if (data.status === "error") {
        failVariant(errorLabel(data.error, ar, gpuOnly));
        return;
      }

      const label = progressLabel(data.progress, ar, gpuOnly);
      setProgress(
        ar
          ? `خيار ${index + 1}/${STUDIO_VIDEO_VARIANT_COUNT} — ${label || "جاري التوليد…"}`
          : `Option ${index + 1}/${STUDIO_VIDEO_VARIANT_COUNT} — ${label || "Generating…"}`,
      );
      setVariants((prev) =>
        prev.map((v) =>
          v.index === index ? { ...v, status: "generating", progress: data.progress } : v,
        ),
      );
      const timer = window.setTimeout(() => {
        void pollVariantRef.current(index, id);
      }, 3500);
      variantTimersRef.current.set(id, timer);
    },
    [ar, gpuOnly, prompt, finalizeVariants],
  );
  pollVariantRef.current = pollVariant;

  const hydrate = useCallback(async () => {
    if (!user) return;
    const cache = readH3UiCache();
    const cachedStartedAt = cache?.elapsedAnchorMs;
    if (cache?.videoUrl) setVideoUrl(cache.videoUrl);
    if (cache?.videoVariants?.length) {
      setVariants(cache.videoVariants);
      if (cache.selectedVariantIndex != null) setSelectedVariantIndex(cache.selectedVariantIndex);
    }
    if (cache?.submittedPrompt) setSubmittedPrompt(cache.submittedPrompt);
    if (cache?.originalPrompt) setOriginalPrompt(cache.originalPrompt);
    if (cache?.info) setInfo(cache.info);
    if (cache?.error) setError(cache.error);
    if (cache?.progress) setProgress(cache.progress);
    if (cache?.generating && cache.jobId && !cache.videoVariants?.length) {
      setJobId(cache.jobId);
      setGenerating(true);
      if (cachedStartedAt != null) startElapsed(cachedStartedAt);
    }
    if (cache?.generating && cache.videoVariants?.length) {
      setGenerating(true);
      pollingActiveRef.current = true;
      if (cachedStartedAt != null) startElapsed(cachedStartedAt);
      for (const v of cache.videoVariants) {
        if (v.jobId && (v.status === "pending" || v.status === "generating")) {
          variantJobIndexRef.current.set(v.jobId, v.index);
          void pollVariant(v.index, v.jobId);
        }
      }
    }

    const resumeFromServer = async (id: string, startedAt?: number): Promise<boolean> => {
      const { res, data } = await fetchJson<H3JobStatus>(
        `/api/h3-lab/status?jobId=${encodeURIComponent(id)}${gpuOnly ? "&gpu_only=1" : ""}`,
        { credentials: "include" },
      );
      if (!res.ok || !data) return false;
      if (data.status === "complete" || data.status === "error") {
        applyJobStatus(data);
        return true;
      }
      if (data.status === "queued" || data.status === "running") {
        const since = data.updatedAt ?? data.createdAt ?? startedAt ?? 0;
        if (gpuOnly && Date.now() - since > 2_700_000) {
          clearStoredH3JobId();
          writeH3UiCache({ generating: false, jobId: undefined });
          return false;
        }
        setProgress(
          progressLabel(data.progress, ar, gpuOnly) || (ar ? "جاري التوليد…" : "Generating…"),
        );
        resumeJob(id, data.createdAt ?? startedAt);
        return true;
      }
      return false;
    };

    try {
      const { res: activeRes, data: active } = await fetchJson<{
        active?: boolean;
        jobId?: string;
        createdAt?: number;
      }>("/api/h3-lab/active", { credentials: "include" });
      if (
        activeRes.ok &&
        active?.active &&
        active.jobId &&
        (await resumeFromServer(active.jobId, active.createdAt))
      ) {
        return;
      }
      const storedId =
        readStoredH3JobId() || readH3ActiveJobIdFromCookie() || cache?.jobId?.trim() || null;
      if (storedId && (await resumeFromServer(storedId, cachedStartedAt))) return;
      if (cache?.generating && storedId) {
        resumeJob(storedId, cachedStartedAt);
        return;
      }
      if (cache?.generating) resetGeneration();
      const { res: lastRes, data: last } = await fetchJson<{
        found?: boolean;
        job?: H3JobStatus;
      }>(`/api/h3-lab/last${gpuOnly ? "?gpu_only=1" : ""}`, { credentials: "include" });
      if (lastRes.ok && last?.found && last.job) {
        const job = last.job;
        const url = jobPlayableUrl(job);
        if (url) {
          setVideoUrl(url);
          writeH3UiCache({ videoUrl: url, generating: false });
        }
        if (job.submittedPrompt?.trim()) setSubmittedPrompt(job.submittedPrompt.trim());
        if (job.originalPrompt?.trim()) setOriginalPrompt(job.originalPrompt.trim());
        if (job.info?.trim()) setInfo(job.info.trim());
      }
    } catch {
      // Offline / HTML error page — keep cached UI.
    }
  }, [user, ar, gpuOnly, applyJobStatus, resumeJob, startElapsed, resetGeneration, pollVariant]);

  useEffect(() => {
    if (!user) {
      hydratedRef.current = false;
      stopPolling();
      return;
    }
    if (ready && !hydratedRef.current) {
      hydratedRef.current = true;
      void hydrate();
    }
  }, [user, ready, hydrate, stopPolling]);

  useEffect(() => {
    if (!user) return;
    writeH3UiCache({
      jobId: jobId ?? undefined,
      videoUrl: videoUrl ?? undefined,
      videoVariants: variants.length ? variants : undefined,
      selectedVariantIndex: variants.length ? selectedVariantIndex : undefined,
      generating,
      progress: progress || undefined,
      submittedPrompt: submittedPrompt || undefined,
      originalPrompt: originalPrompt || undefined,
      info: info || undefined,
      error: error || undefined,
      elapsedAnchorMs: generating ? Date.now() - elapsedMs : undefined,
    });
  }, [
    user,
    jobId,
    videoUrl,
    variants,
    selectedVariantIndex,
    generating,
    progress,
    submittedPrompt,
    originalPrompt,
    info,
    error,
    elapsedMs,
  ]);

  useEffect(
    () => () => {
      hydratedRef.current = false;
      stopPolling();
    },
    [stopPolling],
  );

  useEffect(() => {
    const onVisible = () => {
      if (document.hidden) return;
      const id = activeJobRef.current;
      if (id && pollingActiveRef.current) void pollJobRef.current(id);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const loadConfig = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await fetchJson<H3LabConfig>(
        gpuOnly ? "/api/h3-lab/config?gpu_only=1" : "/api/h3-lab/config",
        { credentials: "include" },
      );
      if (data) setConfig(data);
    } catch {
      // Config endpoint unreachable — keep last known state.
    }
    setConfigLoaded(true);
  }, [user, gpuOnly]);

  const failoverActive = !!(
    rentalGpuFailover ||
    rentalFrozen ||
    config?.gpuFailover ||
    config?.rentalFrozen
  );
  const rentalPaid = gpuOnly && !!(paidHourActive || rentalEndsAt);

  useEffect(() => {
    if (!user) {
      setConfig(null);
      setConfigLoaded(false);
      return;
    }
    void loadConfig();
  }, [user, loadConfig]);

  useLayoutEffect(() => {
    if (!gpuOnly || editBootAppliedRef.current) return;
    const boot = resolveRentalEditBoot();
    if (!boot || boot.studioOrigin !== "ai-rental") return;
    const bootEngine: RentalEngine =
      boot.rentalEngine ??
      (String(boot.modelId || "").trim() === VERONIX_DEPLOYED_MODEL_ID ? "ltx" : "vyronix");
    setEngine(bootEngine);
    if (bootEngine !== "vyronix") return;
    editBootAppliedRef.current = true;
    if (boot.prompt) setPrompt(stripInternalPromptNotes(boot.prompt));
    if (boot.duration != null && Number.isFinite(Number(boot.duration))) {
      setAutoDuration(false);
      setShotSeconds(Math.min(15, Math.max(1, Math.round(Number(boot.duration)))));
    }
    if (boot.aspectRatio && ASPECT_RATIOS.includes(boot.aspectRatio)) {
      setAspectRatio(boot.aspectRatio);
    }
    setInfo(
      ar
        ? "تم تحميل إعدادات التعديل من Assets — راجع الوصف والمدة ثم Generate"
        : "Edit settings loaded from Assets — review prompt and Generate",
    );
    clearEditDraft();
    if (!window.location.search.includes("edit=")) return;
    const url = new URL(window.location.href);
    for (const key of [
      "edit",
      "duration",
      "d",
      "resolution",
      "r",
      "aspect",
      "ar",
      "clarity",
      "c",
      "model",
      "m",
      "engine",
      "studio",
    ]) {
      url.searchParams.delete(key);
    }
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  }, [gpuOnly, ar]);

  useEffect(() => {
    if (!gpuOnly || !user || (config?.canGenerate && config?.podReady && !failoverActive)) return;
    const every = failoverActive ? 8000 : config?.gpuLinked ? 12000 : 6000;
    const id = window.setInterval(() => void loadConfig(), every);
    return () => window.clearInterval(id);
  }, [
    gpuOnly,
    user,
    failoverActive,
    config?.canGenerate,
    config?.podReady,
    config?.gpuLinked,
    loadConfig,
  ]);

  const runpodBackend =
    config?.backend === "runpod_serverless" || config?.runpodReady !== undefined;
  const needsLink = needsVyronixLink && !runpodBackend;

  useEffect(() => {
    if (!generating || !gpuOnly || !user || runpodBackend) return;
    const guard = async () => {
      let data: H3LabConfig | null = null;
      try {
        ({ data } = await fetchJson<H3LabConfig>("/api/h3-lab/config?gpu_only=1&job_guard=1", {
          credentials: "include",
        }));
      } catch {
        return;
      }
      if (!data || data.backend === "runpod_serverless" || data.gpuLive !== false) return;
      const reason = data.gpuOfflineReason || "gpu_offline";
      setError(errorLabel(reason, ar, gpuOnly));
      resetGeneration();
      setVariants((prev) =>
        prev.length === 0
          ? prev
          : prev.map((v) =>
              v.status === "complete"
                ? v
                : { ...v, status: "error", error: errorLabel(reason, ar, gpuOnly) },
            ),
      );
    };
    void guard();
    const id = window.setInterval(() => void guard(), 6000);
    return () => window.clearInterval(id);
  }, [generating, gpuOnly, user, ar, resetGeneration, runpodBackend]);

  useEffect(() => {
    if (!gpuOnly || !user || generating || stopping || gpuRebooting) return;
    const active = config?.activeJob;
    if (active?.jobId && (active.status === "queued" || active.status === "running")) {
      resumeJob(active.jobId, active.createdAt);
    }
  }, [gpuOnly, user, generating, stopping, gpuRebooting, config?.activeJob, resumeJob]);

  useEffect(() => {
    if (!generating) return;
    const id = window.setInterval(() => {
      if (elapsedMs < 120_000) return;
      setProgress(
        (cur) =>
          cur ||
          (ar
            ? "يبدو أن التوليد عالق — جرّب «إيقاف التوليد» ثم Generate من جديد"
            : "Generation may be stuck — try Stop, then Generate again"),
      );
    }, 5000);
    return () => window.clearInterval(id);
  }, [generating, elapsedMs, ar]);

  const preset = QUALITY_PRESETS[speedMode];
  const effectiveMegapixels = gpuOnly
    ? snapMegapixels(preset.megapixels)
    : snapMegapixels(megapixels);
  const steps = preset.steps;
  const clarity = clarityLabel(effectiveMegapixels, aspectRatio);
  const durationPlan = useMemo<DurationPlan>(() => {
    const paragraphCount = countParagraphs(prompt);
    if (gpuOnly) {
      return autoDuration
        ? planAutoDuration(prompt, { paragraphCount, skipSceneAnchor: true, skipSecondsHint: true })
        : planSingleShot(prompt, shotSeconds);
    }
    return autoDuration
      ? planAutoDuration(prompt, { paragraphCount })
      : planPerShot(prompt, shotSeconds);
  }, [autoDuration, shotSeconds, gpuOnly, prompt]);
  const promptDir = hasArabic(prompt) ? "rtl" : dir;

  const selectSpeedMode = (mode: SpeedMode) => {
    setSpeedMode(mode);
    setMegapixels(QUALITY_PRESETS[mode].megapixels);
    if (gpuOnly && !autoDuration) setShotSeconds(QUALITY_PRESETS[mode].duration);
  };

  const addCharacterFile = async (file: File) => {
    if (!file) return;
    if (
      !(
        file.type.startsWith("image/") ||
        /\.(jpe?g|png|gif|webp|heic|heif|bmp|avif)$/i.test(file.name || "")
      )
    ) {
      setError(
        ar ? "الملف ليس صورة — استخدم JPG أو PNG أو HEIC" : "Not an image — use JPG, PNG, or HEIC",
      );
      return;
    }
    const preview = URL.createObjectURL(file);
    const id = crypto.randomUUID();
    let added = false;
    setCharacters((prev) => {
      if (prev.length >= 4) return prev;
      added = true;
      return [...prev, { id, file, preview, name: "" }];
    });
    if (!added) {
      URL.revokeObjectURL(preview);
      return;
    }
    if (gpuOnly) return;
    try {
      const path = await uploadH3File(file);
      setCharacters((prev) => prev.map((c) => (c.id === id ? { ...c, uploadPath: path } : c)));
    } catch (err) {
      setError(
        errorLabel(err instanceof Error ? err.message : undefined, ar, gpuOnly) ||
          (ar ? "تعذّر رفع صورة الشخصية" : "Character image upload failed"),
      );
    }
  };

  const removeCharacter = (id: string) => {
    setCharacters((prev) => {
      const slot = prev.find((c) => c.id === id);
      if (slot?.preview.startsWith("blob:")) URL.revokeObjectURL(slot.preview);
      return prev.filter((c) => c.id !== id);
    });
  };

  const renameCharacter = (id: string, raw: string) => {
    const name = normalizeCharacterName(raw);
    setCharacters((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
  };

  const setFrame = (which: "start" | "end", file: File | undefined) => {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    if (which === "start") {
      if (startFrame?.preview.startsWith("blob:")) URL.revokeObjectURL(startFrame.preview);
      setStartFrame({ file, preview });
    } else {
      if (endFrame?.preview.startsWith("blob:")) URL.revokeObjectURL(endFrame.preview);
      setEndFrame({ file, preview });
    }
  };

  const clearFrame = (which: "start" | "end") => {
    if (which === "start") {
      if (startFrame?.preview.startsWith("blob:")) URL.revokeObjectURL(startFrame.preview);
      setStartFrame(null);
    } else {
      if (endFrame?.preview.startsWith("blob:")) URL.revokeObjectURL(endFrame.preview);
      setEndFrame(null);
    }
  };

  const waitForGpuReboot = useCallback(async () => {
    for (let i = 0; i < 48; i += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 5000));
      try {
        const { res, data } = await fetchJson<H3LabConfig>("/api/h3-lab/config?gpu_only=1", {
          credentials: "include",
        });
        if (
          res.ok &&
          data?.modelsReady &&
          data?.podReachable &&
          !data?.activeJob &&
          data?.canGenerate !== false
        ) {
          setConfig(data);
          setGpuRebooting(false);
          setInfo(ar ? "✓ GPU جاهز — يمكنك التوليد من جديد" : "✓ GPU ready — start a fresh generate");
          return;
        }
      } catch {
        // keep waiting
      }
    }
    setGpuRebooting(false);
    setInfo(
      ar
        ? "GPU قد يحتاج دقيقة إضافية — انتظر ثم جرّب Generate"
        : "GPU may need another minute — wait, then try Generate",
    );
  }, [ar]);

  const stopGeneration = useCallback(async () => {
    if (stopping) return;
    setStopping(true);
    stopPolling();
    pollingActiveRef.current = false;
    submittingRef.current = false;
    variantJobIndexRef.current.clear();
    let unlock: H3UnlockResponse | null = null;
    try {
      const { data } = await fetchJson<H3UnlockResponse>(
        gpuOnly ? "/api/h3-lab/unlock?gpu_only=1" : "/api/h3-lab/unlock",
        { method: "POST", credentials: "include" },
      );
      unlock = data;
    } catch {
      // Still reset the local UI.
    }
    clearH3UiCache();
    clearStoredH3JobId();
    resetGeneration();
    void loadConfig();
    setVideoUrl(null);
    setVariants([]);
    setSelectedVariantIndex(0);
    setSubmittedPrompt("");
    setOriginalPrompt("");
    setEnhanceMode(null);
    setError("");
    setProgress("");
    if (gpuOnly && unlock?.rentalGpuStop?.rebootScheduled) {
      setGpuRebooting(true);
      setInfo(
        ar
          ? "تم إيقاف كل المهام — جاري إعادة تشغيل GPU (1–3 دقائق)"
          : "All jobs stopped — rebooting GPU (1–3 min)",
      );
      void waitForGpuReboot();
    } else {
      setGpuRebooting(false);
      setInfo(
        gpuOnly
          ? ar
            ? "تم إيقاف التوليد — GPU جاهز لتوليد جديد"
            : "Generation stopped — GPU ready for a fresh run"
          : ar
            ? "تم إيقاف التوليد"
            : "Generation stopped",
      );
    }
    setStopping(false);
  }, [ar, gpuOnly, resetGeneration, stopping, waitForGpuReboot, loadConfig, stopPolling]);

  const enhancePrompt = async (mode: EnhanceMode): Promise<string | null> => {
    if (enhancing || prompt.trim().length < 3) {
      setError(
        ar
          ? "اكتب وصف المشهد (3 أحرف على الأقل)"
          : "Enter a scene description (at least 3 characters)",
      );
      return null;
    }
    setEnhancing(true);
    setError("");
    setInfo("");
    setEnhanceNote("");
    try {
      const { res, data } = await fetchJson<{ translated?: string; error?: unknown }>(
        "/api/h3-lab/enhance",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, mode }),
        },
      );
      const translated = (data?.translated || "").trim();
      if (!res.ok || !translated) {
        const message = errorLabel(
          typeof data?.error === "string" ? data.error : undefined,
          ar,
          gpuOnly,
        );
        setEnhanceNote(message);
        setError(message);
        return null;
      }
      const incomplete =
        mode === "literal" ? !isAcceptableLiteralEnglish(translated) : hasArabic(translated);
      if (incomplete) {
        const message = ar ? "الترجمة لم تكتمل — حاول مرة أخرى" : "Translation incomplete — try again";
        setEnhanceNote(message);
        setError(message);
        return null;
      }
      setOriginalPrompt(prompt.trim());
      setPrompt(translated);
      setEnhanceMode(mode);
      const note =
        mode === "literal"
          ? ar
            ? "✓ ترجمة حرفية — بدون تحسين Gemini"
            : "✓ Literal translation — no Gemini enhancement"
          : ar
            ? "✓ Gemini — سيناريو سينمائي جاهز، راجع ثم اضغط Generate"
            : "✓ Gemini cinematic screenplay ready — review, then Generate";
      setEnhanceNote(note);
      setInfo(note);
      return translated;
    } catch (err) {
      const message =
        err instanceof Error
          ? errorLabel(err.message, ar, gpuOnly)
          : ar
            ? "تعذّرت الترجمة"
            : "Translation failed";
      setEnhanceNote(message);
      setError(message);
      return null;
    } finally {
      setEnhancing(false);
    }
  };

  const gpuLinked = !!(
    config?.gpuLinked ||
    config?.configured ||
    config?.backend ||
    rentalPodReady ||
    (studioUnlocked && rentalVyronixId)
  );
  const modelsReady = !!(config?.modelsReady || rentalPodReady || (runpodBackend && rentalPaid));
  const vyronixId = rentalVyronixId ?? config?.vyronixId;
  const prepStartedAt = rentalPrepStartedAt ?? config?.prepStartedAt;
  const rentalTimeActive = !!(paidHourActive || rentalEndsAt);
  const studioReady = !!(
    !gpuOnly ||
    !configLoaded ||
    (runpodBackend &&
      rentalTimeActive &&
      !failoverActive &&
      !needsLink &&
      (rentalPaid || studioUnlocked || config?.canGenerate || rentalCanGenerate)) ||
    (studioUnlocked && rentalPodReady && rentalTimeActive && !needsLink) ||
    (modelsReady &&
      (gpuLinked || config?.configured || rentalPodReady) &&
      (config?.canGenerate || rentalCanGenerate || rentalPaid || (studioUnlocked && modelsReady)))
  );
  const showStudioReadyChip =
    gpuOnly &&
    (modelsReady || (runpodBackend && rentalPaid)) &&
    !failoverActive &&
    !needsLink &&
    (rentalPaid || !!config?.canGenerate || rentalCanGenerate);
  const canSubmitConfig = !!(gpuLinked || studioUnlocked || config?.configured);
  const charactersUploading = !gpuOnly && characters.some((c) => !c.uploadPath);
  const serverJobActive = !!(
    gpuOnly &&
    config?.activeJob?.jobId &&
    (config.activeJob.status === "queued" || config.activeJob.status === "running")
  );
  const busy = generating || serverJobActive;
  const generateDisabled =
    generating ||
    enhancing ||
    stopping ||
    gpuRebooting ||
    charactersUploading ||
    needsLink ||
    (gpuOnly &&
      !studioUnlocked &&
      !(rentalPodReady && rentalTimeActive && !needsLink) &&
      !(runpodBackend && rentalPaid)) ||
    (gpuOnly && configLoaded && !studioReady);
  const maxParallel = gpuOnly ? Math.min(4, config?.maxParallel ?? 4) : 4;

  useEffect(() => {
    setOutputCount((n) => Math.min(Math.max(1, n), maxParallel));
  }, [maxParallel]);

  const generate = async () => {
    if (generating || submittingRef.current || enhancing || stopping || gpuRebooting) return;
    if (prompt.trim().length < 3) {
      setError(
        ar
          ? "اكتب وصف المشهد (3 أحرف على الأقل)"
          : "Enter a scene description (at least 3 characters)",
      );
      return;
    }
    if (configLoaded && config && !canSubmitConfig && !rentalPaid) return;

    let promptToSend = prompt;
    submittingRef.current = true;
    stopPolling();
    pollingActiveRef.current = true;
    setGenerating(true);
    setError("");
    setInfo("");
    setSubmittedPrompt("");
    if (!enhanceMode) setOriginalPrompt("");
    setVideoUrl(null);
    setVariants([]);
    setSelectedVariantIndex(0);
    startElapsed();
    setProgress(ar ? "إرسال الطلب…" : "Submitting…");

    try {
      let startFramePath: string | undefined;
      let endFramePath: string | undefined;
      if (!gpuOnly && characters.some((c) => !c.uploadPath)) {
        setProgress(ar ? "رفع صور الشخصيات…" : "Uploading character images…");
      }
      if (gpuOnly && startFrame) {
        setProgress(ar ? "رفع الإطار الأول…" : "Uploading start frame…");
        startFramePath = await uploadH3File(startFrame.file);
      }
      if (gpuOnly && endFrame) {
        setProgress(ar ? "رفع الإطار الأخير…" : "Uploading end frame…");
        endFramePath = await uploadH3File(endFrame.file);
      }

      const refs: VisualReference[] = characters.map((c) => {
        const name = normalizeCharacterName(c.name);
        return { type: "image", id: c.id, url: c.preview, label: name || c.name };
      });
      const bound = orderCharacterRefsForBinding(promptToSend, refs)
        .map((ref) => characters.find((c) => c.id === ref.id))
        .filter((c): c is CharacterSlot => !!c);
      const ordered =
        bound.length >= characters.length
          ? bound
          : [...bound, ...characters.filter((c) => !bound.some((b) => b.id === c.id))];

      const refPaths: string[] = [];
      const refNames: string[] = [];
      for (let i = 0; i < ordered.length; i += 1) {
        const slot = ordered[i];
        refNames.push(normalizeCharacterName(slot.name));
        if (!slot.uploadPath) {
          setProgress(ar ? `رفع شخصية ${i + 1}…` : `Uploading character ${i + 1}…`);
        }
        const path = slot.uploadPath || (await uploadH3File(slot.file));
        if (!slot.uploadPath) {
          setCharacters((prev) =>
            prev.map((c) => (c.id === slot.id ? { ...c, uploadPath: path } : c)),
          );
        }
        refPaths.push(path);
      }

      const bundle =
        gpuOnly && !isAdmin && ordered.length > 0
          ? buildH3StudioCharacterBundle(promptToSend, ordered)
          : null;
      if (bundle?.prompt.trim()) promptToSend = bundle.prompt;
      const characterMemory =
        gpuOnly && !isAdmin && ordered.length > 0
          ? characterNotes.trim() ||
            bundle?.characterMemory ||
            buildH3Smite79CharacterMemory(ordered.map((c) => ({ name: c.name })))
          : characterNotes || undefined;

      const buildBody = (
        seedValue: number,
        variant?: { variantBatchId: string; variantIndex: number; variantTotal: number },
      ) => ({
        prompt: promptToSend,
        character_memory: characterMemory,
        exposed_terms: bundle?.exposedTerms || undefined,
        ref_images: refPaths.length ? refPaths : undefined,
        ref_character_names: refNames.length ? refNames : undefined,
        start_frame: startFramePath,
        end_frame: endFramePath,
        resolution: aspectRatio,
        megapixels: effectiveMegapixels,
        shot_seconds: autoDuration ? undefined : shotSeconds,
        auto_duration: autoDuration || undefined,
        speed_mode: speedMode,
        plan_only: planOnly,
        prevent_nudity: true,
        lock_restraints: true,
        anatomy_guard: "auto",
        solidity_guard: "auto",
        motion_guard: "auto",
        shift_video: 12,
        shift_audio: 3,
        steps,
        seed: seedValue,
        lora,
        locale,
        gpu_only: gpuOnly || undefined,
        prompt_ready:
          (gpuOnly && (isAdmin || enhanceMode === "literal" || enhanceMode === "screenplay")) ||
          (gpuOnly && !hasArabic(promptToSend)) ||
          undefined,
        variant_batch_id: variant?.variantBatchId,
        variant_index: variant?.variantIndex,
        variant_total: variant?.variantTotal,
      });

      const count = gpuOnly ? Math.min(4, Math.max(1, outputCount)) : outputCount;

      if (gpuOnly && !planOnly && count > 1) {
        const batchId = crypto.randomUUID();
        const variantCount = Math.min(STUDIO_VIDEO_VARIANT_COUNT, Math.max(1, count));
        const baseSeed = seed > 0 ? seed : Math.floor(1e6 * Math.random());
        const seeds = Array.from({ length: variantCount }, (_, i) => baseSeed + 10007 * i);
        const initial: H3VideoVariant[] = seeds.map((s, index) => ({
          index,
          seed: s,
          status: "pending",
        }));
        setVariants(initial);
        setSelectedVariantIndex(0);
        setProgress(ar ? `إرسال ${seeds.length} فيديو…` : `Submitting ${seeds.length} videos…`);

        const next = [...initial];
        let anyStarted = false;
        for (let i = 0; i < seeds.length; i += 1) {
          const { res, data } = await fetchJson<H3GenerateResponse>("/api/h3-lab/generate", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              buildBody(seeds[i], { variantBatchId: batchId, variantIndex: i, variantTotal: count }),
            ),
          });
          if (res.ok && data?.jobId) {
            anyStarted = true;
            next[i] = { ...next[i], jobId: data.jobId, status: "generating" };
            variantJobIndexRef.current.set(data.jobId, i);
            if (i === 0) {
              setJobId(data.jobId);
              storeH3JobId(data.jobId);
              if (data.submittedPrompt?.trim()) setSubmittedPrompt(data.submittedPrompt.trim());
              if (data.originalPrompt?.trim()) setOriginalPrompt(data.originalPrompt.trim());
              else if (prompt.trim()) setOriginalPrompt(prompt.trim());
            }
            void pollVariant(i, data.jobId);
          } else {
            next[i] = {
              ...next[i],
              status: "error",
              error: errorLabel(
                typeof data?.error === "string" ? data.error : undefined,
                ar,
                gpuOnly,
              ),
            };
          }
          setVariants([...next]);
        }
        if (!anyStarted) {
          setError(ar ? "تعذر بدء التوليد" : "Could not start generation");
          resetGeneration();
          setVariants([]);
          return;
        }
        setProgress(ar ? `جاري توليد ${seeds.length} فيديو…` : `Generating ${seeds.length} videos…`);
        return;
      }

      const { res, data } = await fetchJson<H3GenerateResponse>("/api/h3-lab/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(seed)),
      });
      if (!res.ok || !data?.jobId) {
        setError(
          typeof data?.error === "string"
            ? errorLabel(data.error, ar, gpuOnly)
            : ar
              ? "تعذر بدء التوليد"
              : "Could not start generation",
        );
        resetGeneration();
        return;
      }
      setJobId(data.jobId);
      storeH3JobId(data.jobId);
      if (data.submittedPrompt?.trim()) setSubmittedPrompt(data.submittedPrompt.trim());
      if (data.originalPrompt?.trim()) setOriginalPrompt(data.originalPrompt.trim());
      else if (prompt.trim()) setOriginalPrompt(prompt.trim());
      void pollJob(data.jobId);
    } catch (err) {
      setError(
        errorLabel(
          err instanceof Error ? err.message : ar ? "تعذّر الاتصال" : "Connection failed",
          ar,
          gpuOnly,
        ),
      );
      resetGeneration();
    } finally {
      submittingRef.current = false;
    }
  };

  const generateLabel = busy
    ? ar
      ? "جاري التوليد…"
      : "Generating…"
    : gpuRebooting
      ? ar
        ? "GPU يعاد تشغيله…"
        : "GPU rebooting…"
      : enhancing
        ? ar
          ? "جاري الترجمة…"
          : "Translating…"
        : planOnly
          ? ar
            ? "معاينة الخطة"
            : "Preview plan"
          : outputCount > 1 && gpuOnly
            ? `Generate ×${outputCount}`
            : t.create.generate;
  const showResultCard = gpuOnly && !planOnly && (busy || !!videoUrl || variants.length > 0);
  const resultSlots =
    outputCount > 1 && (generating || variants.length > 0)
      ? Math.max(variants.length, outputCount)
      : variants.length > 0
        ? variants.length
        : generating || videoUrl
          ? 1
          : 0;
  const clockStartedAt = generating ? Date.now() - elapsedMs : Date.now();

  const generateHint =
    !gpuOnly || studioUnlocked || generating ? (
      needsLink ? (
        <p className="text-center text-xs leading-relaxed text-[#22f0ff]/90">
          {ar
            ? "أدخل فيرونيكس ID أعلاه لربط الاستوديو بـ GPU قبل التوليد"
            : "Enter your Vyronix ID above to link the studio GPU before generating"}
        </p>
      ) : gpuOnly && configLoaded && !studioReady && !generating ? (
        <p className="text-center text-xs leading-relaxed text-amber-200/85">
          {failoverActive
            ? t.studioRental.failoverTitle
            : ar
              ? "انتظر حتى يظهر «الاستوديو جاهز» — الواجهة تتحقق من GPU كل بضع ثوانٍ"
              : "Wait for «Studio ready» — the UI polls your GPU every few seconds"}
        </p>
      ) : null
    ) : (
      <p className="text-center text-xs leading-relaxed text-amber-200/85">
        {ar ? "اشترك من " : "Subscribe from "}
        <Link href={STUDIO_RENTAL_PRICING_PATH} className="font-semibold text-[#22f0ff] underline">
          {ar ? "صفحة الباقات" : "the pricing page"}
        </Link>
        {ar ? " لتفعيل التوليد" : " to unlock generation"}
      </p>
    );

  if (!ready && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0d12]">
        <Loader2 className="h-8 w-8 animate-spin text-[#22f0ff]" />
      </div>
    );
  }

  if (ready && !user && !(guestStudioPreview && gpuOnly)) {
    return (
      <div className="min-h-screen bg-[#0b0d12] px-4 py-12 text-center text-white">
        <p className="mb-4">{ar ? "سجّل الدخول لاستخدام المختبر" : "Sign in to use H3 Lab"}</p>
        <Link href={loginHref(returnPath)} className="text-[#22f0ff] underline">
          {ar ? "تسجيل الدخول" : "Login"}
        </Link>
      </div>
    );
  }

  const qualityButtons = SPEED_MODES.map((mode) => {
    const p = QUALITY_PRESETS[mode];
    const active = speedMode === mode;
    return (
      <button
        key={mode}
        type="button"
        onClick={() => selectSpeedMode(mode)}
        className={`rounded-xl border px-2 py-2.5 text-center text-xs font-semibold transition ${
          active
            ? "border-[#22f0ff]/50 bg-[#22f0ff]/15 text-[#22f0ff]"
            : "border-white/10 bg-black/20 text-white/55 hover:border-[#22f0ff]/25"
        }`}
      >
        {ar ? p.labelAr : p.labelEn}
      </button>
    );
  });

  const stopLabel = stopping ? (ar ? "إيقاف…" : "Stop…") : ar ? "إيقاف" : "Stop";
  const liveProgress = progressLabel(progress, ar, gpuOnly) || (ar ? "جاري التوليد…" : "Generating…");

  return (
    <div className="relative min-h-[100dvh] bg-[#0b0d12] text-white">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 studio-backdrop" />
      <AppHeader
        compact
        user={user}
        onLogout={() => void logout()}
        ready={ready}
        refreshing={refreshing}
      />
      <main className="overflow-x-hidden pb-bottom-nav">
        {topSection ? (
          <div className="mx-auto max-w-3xl px-4 pt-3 sm:px-6">{topSection}</div>
        ) : null}

        {hideHeroCard ? (
          gpuOnly ? (
            <section className="mx-auto max-w-3xl px-4 pt-2 sm:px-6" dir={dir}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <DeployStamp className="text-[10px] font-mono text-white/40" />
                <div className="flex flex-wrap items-center gap-2">
                  {needsVyronixLink ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#22f0ff]/35 bg-[#22f0ff]/10 px-3 py-1 text-[11px] font-semibold text-[#c8fbff]">
                      {ar ? "○ أدخل Vyronix ID للربط" : "○ Enter Vyronix ID to link"}
                    </span>
                  ) : rentalPodReady && studioUnlocked ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-100">
                      {ar ? "● GPU مربوط — الاستوديو جاهز" : "● GPU linked — studio ready"}
                    </span>
                  ) : gpuLinked ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-100">
                      {ar ? "● GPU متصل — جاري التحميل…" : "● GPU connected — loading…"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/55">
                      {ar ? "○ GPU غير مربوط" : "○ GPU not linked"}
                    </span>
                  )}
                  {rentalEndsAt ? (
                    <RentalDigitalClock
                      endsAt={rentalEndsAt}
                      startedAt={rentalStartedAt}
                      ar={ar}
                      compact
                      showWindow
                    />
                  ) : null}
                </div>
              </div>
            </section>
          ) : null
        ) : (
          <section className="mx-auto max-w-3xl px-4 pt-3 sm:px-6 sm:pt-6" dir={dir}>
            <div className="rounded-3xl border border-white/8 bg-gradient-to-br from-[#141821] via-[#10141c] to-[#0b0d12] p-5 sm:p-7">
              <BrandLogo size="lg" className="mb-4" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#22f0ff]/85 sm:text-xs sm:tracking-[0.24em]">
                {gpuOnly
                  ? ar
                    ? AI_RENTAL_STUDIO_NAME_AR
                    : AI_RENTAL_STUDIO_NAME
                  : ar
                    ? "MiniMax H3 · فيديو طويل"
                    : "MiniMax H3 · Long video"}
              </p>
              <h1 className="mt-2 font-display text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
                {gpuOnly
                  ? ar
                    ? AI_RENTAL_STUDIO_NAME_AR
                    : AI_RENTAL_STUDIO_NAME
                  : ar
                    ? "مختبر H3 Long Videos"
                    : "H3 Long Videos Lab"}
              </h1>
              <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-white/55 sm:text-sm">
                {gpuOnly
                  ? ar
                    ? "اكتب بالعربية أو الإنجليزية — اضغط Generate مباشرة، أو استخدم «تحسين Gemini» / «ترجمة حرفية» اختيارياً."
                    : "Arabic or English — tap Generate directly, or optionally use Gemini enhance / literal translate."
                  : ar
                    ? "اكتب بالعربية أو الإنجليزية — الترجمة والتحسين تلقائي عند التوليد (مثل Turbo). الفقرة الأولى = المكان والإضاءة، والسطر الفاضي = لقطة."
                    : "Arabic or English — auto-translated and enhanced on generate (like Turbo). First paragraph = place & light; blank line = new shot."}
              </p>
              {gpuOnly ? (
                <div className="mt-3 flex flex-col items-start gap-2">
                  <DeployStamp className="text-[10px] font-mono text-white/40" />
                  <div className="flex w-full flex-wrap items-center gap-3">
                    {rentalEndsAt && studioReady ? (
                      <div className="inline-flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 sm:px-4">
                        {failoverActive ? (
                          <span className="text-[11px] font-semibold text-amber-100 sm:text-xs">
                            {t.studioRental.failoverTitle}
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-emerald-100 sm:text-xs">
                            {t.studioRental.studioReady}
                          </span>
                        )}
                        <span className="hidden h-4 w-px bg-emerald-400/30 sm:inline" aria-hidden />
                        <RentalDigitalClock
                          endsAt={rentalEndsAt}
                          startedAt={rentalStartedAt}
                          ar={ar}
                          compact
                          showWindow
                        />
                      </div>
                    ) : showStudioReadyChip ? (
                      <div className="inline-flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 sm:px-4">
                        <span className="text-[11px] font-bold text-emerald-100 sm:text-xs">
                          {t.studioRental.studioReady}
                        </span>
                      </div>
                    ) : (
                      <p className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/60">
                        {configLoaded
                          ? failoverActive
                            ? t.studioRental.failoverTitle
                            : gpuLinked && modelsReady
                              ? ar
                                ? "● GPU متصل — جاري تفعيل النماذج…"
                                : "● GPU linked — loading models…"
                              : gpuLinked
                                ? ar
                                  ? "● GPU متصل — انتظر models OK"
                                  : "● GPU linked — waiting for models"
                                : ar
                                  ? "○ GPU غير متصل — انتظر أو Refresh"
                                  : "○ GPU not connected — wait or refresh"
                          : ar
                            ? "● جاري الاتصال بالـ GPU…"
                            : "● Connecting to GPU…"}
                      </p>
                    )}
                  </div>
                  {rentalEndsAt && !studioReady ? (
                    <div className="inline-flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 sm:px-4">
                      <RentalDigitalClock
                        endsAt={rentalEndsAt}
                        startedAt={rentalStartedAt}
                        ar={ar}
                        compact
                        showWindow
                      />
                    </div>
                  ) : null}
                  {configLoaded && gpuLinked && !studioReady && !failoverActive ? (
                    <div className="flex flex-wrap items-start gap-3">
                      <StudioPrepClock
                        label={
                          modelsReady
                            ? ar
                              ? "GPU يفعّل ComfyUI — انتظر «الاستوديو جاهز»"
                              : "GPU starting ComfyUI — wait for «Studio ready»"
                            : ar
                              ? "GPU يحمّل النماذج من R2 — Refresh آمن"
                              : "GPU loading models from R2 — safe to refresh"
                        }
                      />
                      <VyronixIdBadge
                        vyronixId={vyronixId}
                        prepStartedAt={prepStartedAt}
                        ar={ar}
                        compact
                      />
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/60">
                  {configLoaded
                    ? config?.configured
                      ? config.label
                        ? `● ${config.label}`
                        : config.turboUsesSpace
                          ? ar
                            ? "● Turbo = نفس Space (Larry · 6 steps)"
                            : "● Turbo = same as Space (Larry · 6 steps)"
                          : ar
                            ? "● متصل بـ Vast GPU"
                            : "● Vast GPU connected"
                      : ar
                        ? "○ غير مربوط"
                        : "○ Not configured"
                    : ar
                      ? "● جاري الاتصال…"
                      : "● Connecting…"}
                </p>
              )}
            </div>
          </section>
        )}

        <section
          className={`mx-auto max-w-3xl space-y-4 px-4 sm:px-6 ${hideHeroCard ? "pt-3" : "pt-6"} pb-6`}
          dir={dir}
        >
          {!configLoaded || config?.configured || gpuOnly ? null : (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {ar ? "الخدمة غير مربوطة بعد — تواصل مع الدعم." : "Service not configured yet."}
            </div>
          )}

          {gpuOnly ? (
            <div className="space-y-3">{linkSection ? <div>{linkSection}</div> : null}</div>
          ) : null}

          {gpuOnly ? (
            <div className="scroll-mt-24" id="rental-video-model">
              <RentalVideoModelPicker
                value={engine}
                onChange={setEngine}
                ltxAvailable
                vyronixAvailable
                spaceBackendLabel={
                  config?.spaceBackend === "runpod" || config?.backend === "runpod_serverless"
                    ? "RunPod GPU"
                    : "HF Turbo"
                }
                ar={ar}
              />
            </div>
          ) : null}

          {gpuOnly ? (
            <div className={engine === "ltx" ? "" : "hidden"} aria-hidden={engine !== "ltx"}>
              <RentalLtxStudio user={user} onUserRefresh={refreshUser} lockedMedia="video" />
            </div>
          ) : null}

          <div
            className={gpuOnly && engine !== "vyronix" ? "hidden" : "space-y-4"}
            aria-hidden={gpuOnly && engine !== "vyronix"}
          >
            <div className="rounded-2xl border border-dashed border-white/15 bg-[#141821] p-3 sm:p-4">
              <p className="mb-1 text-sm font-medium text-white/80">
                {gpuOnly
                  ? ar
                    ? "صور الشخصيات (مرجع الوجه)"
                    : "Character images (face reference)"
                  : ar
                    ? "صور الشخصيات (REF2VA)"
                    : "Character images (REF2VA)"}{" "}
                <span className="font-normal text-white/45">{ar ? "(اختياري)" : "(optional)"}</span>
              </p>
              <p className="mb-2.5 text-[11px] leading-relaxed text-white/40">
                {gpuOnly
                  ? ar
                    ? "ارفع صورة + اكتب اسم الشخصية في الوصف (أو سيُضاف تلقائياً عند التوليد)"
                    : "Upload photo + name the character in your prompt (or auto-added on generate)"
                  : t.create.charactersHint}
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {characters.map((slot, i) => {
                  const linked = linkedIds.has(slot.id);
                  return (
                    <div
                      key={slot.id}
                      className={`w-[6.75rem] shrink-0 space-y-1.5 rounded-2xl border bg-black/25 p-1.5 sm:w-[9.5rem] ${
                        linked ? "border-[#22f0ff]/55 ring-1 ring-[#22f0ff]/25" : "border-white/10"
                      }`}
                    >
                      <div
                        className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-[#1a1f2a]"
                        role="button"
                        tabIndex={0}
                        onClick={() => insertCharacterName(slot.name)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            insertCharacterName(slot.name);
                          }
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={slot.preview}
                          alt={slot.name || `char-${i + 1}`}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          className="absolute right-1 top-1 rounded-full bg-black/70 p-0.5"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeCharacter(slot.id);
                          }}
                          aria-label={ar ? "حذف الصورة" : "Remove image"}
                        >
                          <X className="h-3 w-3" />
                        </button>
                        {linked ? (
                          <span className="absolute bottom-1 left-1 rounded-full bg-[#22f0ff]/90 px-1.5 py-0.5 text-[8px] font-bold text-black">
                            {ar ? "مربوط" : "Linked"}
                          </span>
                        ) : null}
                        {slot.uploadPath || gpuOnly ? null : (
                          <span className="absolute inset-x-1 bottom-6 rounded bg-black/70 px-1 py-0.5 text-center text-[8px] text-white/80">
                            {ar ? "جاري الرفع…" : "Uploading…"}
                          </span>
                        )}
                      </div>
                      <label className="block space-y-0.5" dir={dir}>
                        <span className="block text-center text-[10px] font-semibold text-[#22f0ff]">
                          {t.create.characterName}
                        </span>
                        <input
                          type="text"
                          value={slot.name}
                          onChange={(e) => renameCharacter(slot.id, e.target.value)}
                          onBlur={() => {
                            if (isCharacterName(slot.name)) insertCharacterName(slot.name);
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
                {characters.length < 4 ? (
                  <label className="flex aspect-[3/4] w-[6.75rem] shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-white/20 text-white/60 sm:w-[9.5rem]">
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-[10px]">{t.create.add}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = e.target.files;
                        if (!files?.length) return;
                        void (async () => {
                          for (const file of Array.from(files)) await addCharacterFile(file);
                        })();
                        e.target.value = "";
                      }}
                    />
                  </label>
                ) : null}
              </div>
              {namedCharacters.length > 0 ? (
                <div className="mt-3 space-y-1.5" dir={dir}>
                  <p className="text-[10px] font-semibold text-white/45">
                    {ar
                      ? "الشخصيات المسماة — اضغط للإدراج في الوصف"
                      : "Named characters — tap to insert into prompt"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {namedCharacters.map((slot) => {
                      const linked = linkedIds.has(slot.id);
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => insertCharacterName(slot.name)}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold transition ${
                            linked
                              ? "border-[#22f0ff]/40 bg-[#22f0ff]/15 text-[#22f0ff]"
                              : "border-white/15 bg-white/5 text-white/55 hover:border-[#22f0ff]/30 hover:text-[#22f0ff]"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={slot.preview}
                            alt=""
                            className="h-4 w-4 rounded-full object-cover"
                          />
                          {normalizeCharacterName(slot.name)}
                          {linked ? <span aria-hidden>✓</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            {gpuOnly ? (
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    { label: spaceLabels.startFrame, preview: startFrame?.preview, which: "start" },
                    { label: spaceLabels.endFrame, preview: endFrame?.preview, which: "end" },
                  ] as const
                ).map((frame) => (
                  <label
                    key={frame.which}
                    className="relative flex min-h-[110px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-[#141821] p-3 text-center"
                  >
                    {frame.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={frame.preview}
                        alt=""
                        className="mb-2 h-16 w-full rounded-lg object-cover"
                      />
                    ) : (
                      <ImagePlus className="mb-2 h-5 w-5 text-white/50" />
                    )}
                    <span className="text-xs text-white/70">{frame.label}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        setFrame(frame.which, e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    {frame.preview ? (
                      <button
                        type="button"
                        className="absolute right-2 top-2 rounded-full bg-black/70 p-1"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          clearFrame(frame.which);
                        }}
                        aria-label={ar ? "حذف الصورة" : "Remove image"}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    ) : null}
                  </label>
                ))}
              </div>
            ) : null}

            <div className="rounded-2xl border border-white/10 bg-[#141821] p-4 sm:p-5">
              <label className="block">
                <span className="text-sm font-medium text-white/80">
                  {ar ? "وصف المشهد" : "Scene description"}
                </span>
                <p className="mt-0.5 text-[11px] text-white/40">
                  {gpuOnly
                    ? ar
                      ? "سطر فارغ = لقطة جديدة · الترجمة/التحسين اختياري من الأزرار أدناه"
                      : "Blank line = new shot · translate/enhance optional via buttons below"
                    : ar
                      ? "✓ العربية مدعومة — اكتب بالعربية وسيُترجم تلقائياً عند التوليد. سطر فارغ = لقطة جديدة."
                      : "✓ Arabic supported — write in Arabic; it auto-translates on generate. Blank line = new shot."}
                </p>
                {characters.length > 0 ? (
                  <CharacterLinkBanner
                    linkedCharacters={linkedCharacters}
                    showHint={characterNames.some((name) => isCharacterName(name))}
                    hint={
                      gpuOnly
                        ? ar
                          ? "اكتب اسم الشخصية في الوصف لربط الصورة"
                          : "Use the character name in your prompt to bind the photo"
                        : t.create.charactersHint
                    }
                    title={spaceLabels.charactersLinked}
                    dir={dir}
                  />
                ) : null}
                <textarea
                  dir={promptDir}
                  lang={hasArabic(prompt) ? "ar" : locale}
                  className="mt-2 w-full resize-y whitespace-pre-wrap rounded-xl border border-white/10 bg-[#0f1218] p-3 text-sm leading-relaxed text-white outline-none ring-[#22f0ff]/40 placeholder:text-white/30 focus:ring-2"
                  style={{ unicodeBidi: "plaintext" }}
                  rows={6}
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    setEnhanceMode(null);
                    setEnhanceNote("");
                  }}
                  placeholder={
                    ar
                      ? "ضوء نهاري. مزرعة مع حظيرة.\n\nمحمد يقود فان ويتوقف.\n\nمحمد ينزل ويمشي للحظيرة."
                      : "Daylight. A farm with a barn.\n\nDom drives a van and stops.\n\nDom walks to the barn."
                  }
                />
                {gpuOnly ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void enhancePrompt("literal")}
                      disabled={enhancing || generating || prompt.trim().length < 3}
                      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/75 transition hover:bg-white/10 disabled:opacity-50"
                    >
                      <Languages className="h-4 w-4" />
                      {ar ? "ترجمة حرفية" : "Literal translate"}
                    </button>
                    {enhanceMode === "screenplay" && !hasArabic(prompt) ? (
                      <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200">
                        {ar ? "✓ Gemini — جاهز للتوليد" : "✓ Gemini — ready"}
                      </span>
                    ) : enhanceMode === "literal" && !hasArabic(prompt) ? (
                      <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200">
                        {ar ? "✓ ترجمة حرفية — جاهز" : "✓ Literal — ready"}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {error ? (
                  <div
                    className="mt-2 rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2.5 text-sm text-red-100"
                    role="alert"
                  >
                    {errorLabel(error, ar, gpuOnly)}
                  </div>
                ) : null}
                {gpuOnly && enhanceNote ? (
                  <p
                    className={`mt-2 text-[11px] leading-relaxed ${
                      enhanceNote.startsWith("✓") ? "text-emerald-200/90" : "text-red-200/90"
                    }`}
                  >
                    {enhanceNote}
                  </p>
                ) : null}
                {gpuOnly ? (
                  <div className="mt-4 rounded-xl border border-[#22f0ff]/25 bg-[#22f0ff]/5 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#22f0ff]/90">
                      {ar ? "جودة التوليد" : "Generation quality"}
                    </p>
                    <div className="mt-3 grid grid-cols-3 gap-2">{qualityButtons}</div>
                    <p className="mt-2 text-center text-[11px] leading-relaxed text-white/50">
                      {ar ? preset.hintAr : preset.hintEn}
                    </p>
                    <p className="mt-1 text-center font-mono text-sm tabular-nums text-[#22f0ff]">
                      {clarity}
                    </p>
                    <p className="mt-1 text-center text-[10px] text-white/40">
                      {ar ? `${steps} خطوات · Larry` : `${steps} steps · Larry`}
                    </p>
                  </div>
                ) : null}
              </label>
            </div>

            {gpuOnly ? null : (
              <div className="rounded-2xl border border-white/10 bg-[#141821] p-4 sm:p-5">
                <label className="block">
                  <span className="text-sm font-medium text-white/80">
                    {ar ? "الشخصيات (اختياري)" : "Characters (optional)"}
                  </span>
                  <p className="mt-0.5 text-[11px] text-white/40">
                    {ar
                      ? "مواصفات المظهر — مثل: Dom = he, tall, brunette, white t-shirt"
                      : "Appearance notes — e.g. Dom = he, tall, brunette, white t-shirt"}
                  </p>
                  <textarea
                    className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#0f1218] p-3 text-sm leading-relaxed text-white outline-none ring-[#22f0ff]/40 placeholder:text-white/30 focus:ring-2"
                    rows={3}
                    value={characterNotes}
                    onChange={(e) => setCharacterNotes(e.target.value)}
                    placeholder="Dom = he, tall, 35, brunette, white t-shirt, blue jeans"
                  />
                </label>
              </div>
            )}

            {gpuOnly ? null : (
              <div className="rounded-2xl border border-white/10 bg-[#141821] p-4 sm:p-5">
                <p className="mb-2 text-sm font-medium text-white/80">
                  {ar ? "جودة التوليد" : "Generation quality"}
                </p>
                <div className="grid grid-cols-3 gap-2">{qualityButtons}</div>
                <p className="mt-2 text-[11px] leading-relaxed text-white/40">
                  {ar ? preset.hintAr : preset.hintEn}
                </p>
                <p className="mt-1 text-[10px] text-white/35">
                  {ar
                    ? `الحالي: ${effectiveMegapixels} MP · ${preset.steps} خطوات · ${preset.duration} ث`
                    : `Current: ${effectiveMegapixels} MP · ${preset.steps} steps · ${preset.duration}s`}
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-[#141821] p-4">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-white/45">
                    {ar ? "نسبة العرض" : "Aspect ratio"}
                  </span>
                  <select
                    value={aspectRatio}
                    onChange={(e) => {
                      const next = e.target.value;
                      setAspectRatio(next);
                      if (gpuOnly) sessionStorage.setItem(RENTAL_ASPECT_STORAGE_KEY, next);
                    }}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-[#0f1218] px-3 py-2.5 text-sm outline-none ring-[#22f0ff]/40 focus:ring-2"
                  >
                    {ASPECT_RATIOS.map((ratio) => (
                      <option key={ratio} value={ratio}>
                        {ratio}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {gpuOnly ? null : (
                <div className="rounded-2xl border border-white/10 bg-[#141821] p-4">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-white/45">
                      {ar ? "الوضوح (MP)" : "Clarity (MP)"}
                    </span>
                    <p className="mt-1 text-[10px] text-white/40">
                      {ar ? "0.1 – 1 MP — كل القيم متاحة" : "0.1 – 1 MP — full range"}
                    </p>
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.01}
                      value={effectiveMegapixels}
                      onChange={(e) => setMegapixels(Number(e.target.value))}
                      className="mt-3 w-full accent-[#22f0ff]"
                    />
                    <p className="mt-2 text-center font-mono text-sm tabular-nums text-[#22f0ff]">
                      {clarity}
                    </p>
                    <p className="mt-1 text-center text-[10px] text-white/40">
                      {ar ? `${steps} خطوات · Turbo/Larry` : `${steps} steps · Turbo/Larry`}
                    </p>
                    <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                      {MEGAPIXEL_PRESETS.map((mp) => (
                        <button
                          key={mp}
                          type="button"
                          onClick={() => setMegapixels(mp)}
                          className={`rounded-lg border px-2 py-1 text-[10px] font-semibold tabular-nums transition ${
                            effectiveMegapixels === mp
                              ? "border-[#22f0ff]/50 bg-[#22f0ff]/15 text-[#22f0ff]"
                              : "border-white/10 bg-black/20 text-white/50 hover:border-[#22f0ff]/25"
                          }`}
                        >
                          {mp}
                        </button>
                      ))}
                    </div>
                  </label>
                </div>
              )}

              <div className="rounded-2xl border border-white/10 bg-[#141821] p-4 sm:col-span-2">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-white/45">
                    {autoDuration
                      ? ar
                        ? "فيرونيكس أوتو — 15 ث/فقرة · حتى 120 ث"
                        : "Vyronix Auto — 15s/paragraph · up to 120s"
                      : ar
                        ? `مدة اللقطة — حتى ${maxShotSeconds} ث`
                        : `Shot length — up to ${maxShotSeconds}s`}
                  </span>
                  <p className="mt-1 text-[10px] text-white/40">
                    {autoDuration
                      ? ar
                        ? "Turbo/Larry · 15 ث لكل فقرة — كل فقرة = لقطة (سطر فارغ بين الفقرات)."
                        : "Turbo/Larry · 15s per paragraph — each paragraph = one shot (blank line between)."
                      : gpuOnly
                        ? ar
                          ? `لقطة واحدة حتى ${maxShotSeconds} ث — حرّك الشريط (بدون أوتو).`
                          : `Single shot up to ${maxShotSeconds}s — use the slider (no Auto needed).`
                        : ar
                          ? "H3 (Smite79) ~15 ث/لقطة — للفيدio الأطول فعّل «أوتو» أو أضف لقطات (سطر فارغ)."
                          : "H3 (Smite79) ~15s per shot — for longer video enable Auto or add shots (blank line)."}
                  </p>
                  <input
                    type="range"
                    min={1}
                    max={maxShotSeconds}
                    step={1}
                    value={autoDuration ? durationPlan.expectedTotalSeconds : shotSeconds}
                    disabled={autoDuration}
                    onChange={(e) => setShotSeconds(Number(e.target.value))}
                    className="mt-3 w-full accent-[#22f0ff] disabled:opacity-40"
                  />
                  <p className="mt-2 text-center font-mono text-lg font-bold tabular-nums text-[#22f0ff]">
                    {autoDuration ? durationPlan.expectedTotalSeconds : shotSeconds}
                    <span className="text-sm font-normal text-white/50">
                      {autoDuration
                        ? ar
                          ? " ث (كلي)"
                          : "s total"
                        : gpuOnly
                          ? ar
                            ? " ث (لقطة واحدة)"
                            : "s (single shot)"
                          : ar
                            ? " ث/لقطة"
                            : "s/shot"}
                    </span>
                  </p>
                  <p className="mt-1 text-center text-[10px] text-white/45">
                    {autoDuration
                      ? ar
                        ? `≈ ${durationPlan.beatCount} فقرة × 15 ث → ~${durationPlan.expectedTotalSeconds} ث`
                        : `≈ ${durationPlan.beatCount} paragraphs × 15s → ~${durationPlan.expectedTotalSeconds}s`
                      : gpuOnly
                        ? ar
                          ? `لقطة واحدة → ${shotSeconds} ث`
                          : `Single shot → ${shotSeconds}s`
                        : ar
                          ? `≈ ${durationPlan.perShotSeconds.toFixed(1)} ث/لقطة × ${durationPlan.beatCount} → ~${durationPlan.expectedTotalSeconds} ث`
                          : `≈ ${durationPlan.perShotSeconds.toFixed(1)}s/shot × ${durationPlan.beatCount} → ~${durationPlan.expectedTotalSeconds}s`}
                  </p>
                  {autoDuration ? (
                    <p className="mt-2 text-center text-[10px] text-amber-200/75">
                      {ar
                        ? `≈ ${durationPlan.expectedTotalSeconds} ث = ${durationPlan.beatCount} فقرة × 15 ث — لا توسيع تلقائي.`
                        : `≈ ${durationPlan.expectedTotalSeconds}s = ${durationPlan.beatCount} paragraphs × 15s — no auto expansion.`}
                    </p>
                  ) : shotSeconds > 6 && !gpuOnly ? (
                    <p className="mt-2 text-center text-[10px] text-amber-200/75">
                      {ar
                        ? "المدة الأطول تأخذ وقتاً أكثر — لا تغلق الصفحة"
                        : "Longer durations take more time — keep this page open"}
                    </p>
                  ) : null}
                </label>
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={autoDuration}
                    onChange={(e) => setAutoDuration(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#22f0ff]"
                  />
                  <span className="text-sm leading-relaxed text-white/75">
                    <span className="font-semibold text-[#22f0ff]">
                      {ar ? "فيرونيكس أوتو" : "Vyronix Auto"}
                    </span>
                    {" — "}
                    {ar
                      ? "15 ث × عدد الفقرات = المدة (حتى 120 ث) — سطر فارغ بين الفقرات."
                      : "15s × paragraph count = duration (up to 120s) — blank line between paragraphs."}
                  </span>
                </label>
              </div>

              {gpuOnly ? (
                <div className="space-y-3 sm:col-span-2">
                  <div className="rounded-2xl border border-[#22f0ff]/25 bg-[#141821] p-3" dir={dir}>
                    <div className="flex items-stretch gap-2">
                      <div
                        className="flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-white/12 bg-black/20 px-2 py-1.5"
                        aria-label={t.create.outputCount}
                      >
                        <span className="text-[10px] font-semibold text-white/55">
                          {ar ? "عدد" : "Count"}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setOutputCount((n) => Math.max(1, n - 1))}
                            disabled={outputCount <= 1 || generating}
                            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white transition active:scale-95 disabled:opacity-40"
                            aria-label={ar ? "إنقاص العدد" : "Decrease count"}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="min-w-[1.5rem] text-center text-base font-black tabular-nums text-white">
                            {outputCount}
                          </span>
                          <button
                            type="button"
                            onClick={() => setOutputCount((n) => Math.min(maxParallel, n + 1))}
                            disabled={outputCount >= maxParallel || generating}
                            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white transition active:scale-95 disabled:opacity-40"
                            aria-label={ar ? "زيادة العدد" : "Increase count"}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        <span className="text-[9px] text-white/40">
                          {ar ? `حتى ${maxParallel} معاً` : `Up to ${maxParallel} parallel`}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={generateDisabled}
                        aria-disabled={generateDisabled}
                        onClick={() => {
                          if (!generateDisabled) void generate();
                        }}
                        className="flex h-[3.25rem] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-3 text-sm font-bold text-white shadow-[0_0_24px_rgba(34,240,255,0.2)] disabled:cursor-not-allowed disabled:opacity-75 sm:gap-2 sm:px-5 sm:text-base"
                      >
                        {busy ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Sparkles className="h-5 w-5" />
                        )}
                        {generateLabel}
                      </button>
                      {busy ? (
                        <button
                          type="button"
                          disabled={stopping}
                          onClick={() => void stopGeneration()}
                          className="flex h-[3.25rem] shrink-0 items-center justify-center gap-1 rounded-2xl border border-red-400/45 bg-red-500/15 px-3 text-xs font-bold text-red-100 disabled:opacity-60 sm:px-4 sm:text-sm"
                        >
                          {stopping ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Square className="h-4 w-4 fill-current" />
                          )}
                          {stopLabel}
                        </button>
                      ) : null}
                    </div>
                    {generateHint ? <div className="mt-2">{generateHint}</div> : null}
                  </div>

                  {showResultCard && !hideFloatingResultCard ? (
                    <div className="space-y-2 rounded-2xl border border-[#22f0ff]/30 bg-[#0b0d12] p-2.5 sm:p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#22f0ff]/90">
                          {generating
                            ? liveProgress
                            : resultSlots > 1
                              ? ar
                                ? `جاري توليد ${resultSlots} فيديو`
                                : `Generating ${resultSlots} videos`
                              : ar
                                ? t.create.resultVideos
                                : "Generation result"}
                        </p>
                        <div className="flex items-center gap-2">
                          {generating ? (
                            <GenerateClock startedAt={clockStartedAt} size="compact" />
                          ) : null}
                          <Link href="/assets" className="text-xs font-semibold text-emerald-300">
                            {ar ? "Assets ←" : "Assets →"}
                          </Link>
                        </div>
                      </div>

                      {resultSlots > 1 ? (
                        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                          {Array.from({ length: resultSlots }, (_, i) => {
                            const variant = variants.find((v) => v.index === i) ?? {
                              index: i,
                              seed: 0,
                              status: "pending" as const,
                            };
                            const url = variant.videoUrl;
                            const pending =
                              generating ||
                              variant.status === "generating" ||
                              (variant.status === "pending" && !!variant.jobId);
                            return (
                              <div
                                key={i}
                                className="overflow-hidden rounded-xl border border-white/10 bg-[#141821]"
                              >
                                <div className="flex items-center justify-between border-b border-white/8 px-2 py-1">
                                  <span className="text-[10px] font-semibold text-white/75">
                                    {ar ? `فيديو ${i + 1}` : `Video ${i + 1}`}
                                  </span>
                                  {pending ? (
                                    <Loader2 className="h-3 w-3 animate-spin text-[#22f0ff]" />
                                  ) : url ? (
                                    <span className="text-[9px] text-emerald-300">
                                      {ar ? "جاهز" : "Ready"}
                                    </span>
                                  ) : variant.status === "error" ? (
                                    <span className="text-[9px] text-red-300">
                                      {ar ? "فشل" : "Failed"}
                                    </span>
                                  ) : null}
                                </div>
                                {url ? (
                                  <video
                                    src={url}
                                    controls
                                    playsInline
                                    preload="metadata"
                                    className="aspect-[9/16] w-full bg-black object-cover"
                                  />
                                ) : (
                                  <div className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-1.5 px-2 text-center">
                                    {variant.status === "error" ? (
                                      <span className="text-[10px] text-red-300/90">
                                        {variant.error || (ar ? "فشل" : "Failed")}
                                      </span>
                                    ) : pending ? (
                                      <>
                                        <Loader2 className="h-5 w-5 animate-spin text-[#22f0ff]" />
                                        <span className="text-[10px] text-white/55">
                                          {progressLabel(variant.progress, ar, gpuOnly) ||
                                            (ar ? "جاري…" : "Generating…")}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-[10px] text-white/35">
                                        {ar ? "بانتظار" : "Waiting"}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : generating && !videoUrl ? (
                        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#141821] px-4 py-8">
                          <GenerateClock startedAt={clockStartedAt} size="large" />
                          <p className="text-xs font-semibold text-white/75">{liveProgress}</p>
                        </div>
                      ) : videoUrl ? (
                        <video
                          key={videoUrl}
                          src={videoUrl}
                          controls
                          playsInline
                          preload="metadata"
                          className="w-full rounded-xl border border-white/10"
                        />
                      ) : null}

                      {generating ? (
                        <div className="flex items-center justify-between gap-2 border-t border-white/8 pt-2">
                          <p className="min-w-0 truncate text-[10px] text-amber-100/85">
                            {liveProgress}
                          </p>
                          <button
                            type="button"
                            disabled={stopping}
                            onClick={() => void stopGeneration()}
                            className="shrink-0 rounded-lg border border-red-400/45 bg-red-500/15 px-2.5 py-1 text-[10px] font-bold text-red-100 disabled:opacity-60"
                          >
                            {stopLabel}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {gpuOnly ? null : (
            <>
              <button
                type="button"
                onClick={() => setAdvancedOpen((open) => !open)}
                className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-[#141821] px-4 py-2.5 text-xs font-medium text-white/55"
              >
                {ar ? "إعدادات متقدمة (اختياري)" : "Advanced settings (optional)"}
                <ChevronDown className={`h-4 w-4 transition ${advancedOpen ? "rotate-180" : ""}`} />
              </button>
              {advancedOpen ? (
                <div className="space-y-3 rounded-2xl border border-white/10 bg-[#141821] p-4">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-white/45">
                      {ar ? "Seed (نفس Space)" : "Seed (same as Space)"}
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={0x7fffffff}
                      value={seed}
                      onChange={(e) => setSeed(Math.max(0, Number(e.target.value) || 0))}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-[#0f1218] px-3 py-2.5 text-sm outline-none ring-[#22f0ff]/40 focus:ring-2"
                    />
                    <p className="mt-1 text-[10px] text-white/40">
                      {ar ? "الافتراضي 42 — نفس /space" : "Default 42 — matches /space"}
                    </p>
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-white/45">
                      LoRA
                    </span>
                    <select
                      value={lora}
                      onChange={(e) => setLora(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-[#0f1218] px-3 py-2.5 text-sm outline-none ring-[#22f0ff]/40 focus:ring-2"
                    >
                      <option value="larry">Larry (Turbo)</option>
                      <option value="lightx">LightX</option>
                      <option value="off">{ar ? "إيقاف" : "Off"}</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white/70">
                    <input
                      type="checkbox"
                      checked={planOnly}
                      onChange={(e) => setPlanOnly(e.target.checked)}
                    />
                    {ar ? "خطة نصية فقط — بدون فيديو" : "Text plan only — no video"}
                  </label>
                </div>
              ) : null}
            </>
          )}

          {extraSection ? <div className="space-y-4">{extraSection}</div> : null}

          {gpuOnly ? null : (
            <>
              <button
                type="button"
                disabled={generateDisabled}
                aria-disabled={generateDisabled}
                onClick={() => {
                  if (!generateDisabled) void generate();
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#22f0ff] to-[#7c5cff] px-4 py-3.5 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {generateLabel}
              </button>
              {generateHint}
            </>
          )}

          {generating && !gpuOnly ? (
            <div className="rounded-2xl border border-[#22f0ff]/25 bg-[#22f0ff]/5 px-4 py-4">
              <ElapsedDial elapsedMs={elapsedMs} elapsedSec={elapsedSec} active={generating} />
              <p className="mt-3 text-center text-sm text-amber-100/90">
                {progressLabel(progress, ar, gpuOnly) ||
                  (ar
                    ? "قد يستغرق عدة دقائق — لا تغلق الصفحة"
                    : "May take several minutes — keep this page open")}
              </p>
              <button
                type="button"
                disabled={stopping}
                onClick={() => void stopGeneration()}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-400/45 bg-red-500/15 px-4 py-3 text-sm font-bold text-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {stopping ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Square className="h-4 w-4 fill-current" />
                )}
                {stopping
                  ? ar
                    ? "جاري الإيقاف…"
                    : "Stopping…"
                  : ar
                    ? "إيقاف التوليد"
                    : "Stop generation"}
              </button>
            </div>
          ) : null}

          {originalPrompt && originalPrompt !== submittedPrompt && !gpuOnly ? (
            <div className="rounded-2xl border border-white/10 bg-[#141821] p-3 text-xs text-white/70">
              <p className="mb-1 font-semibold text-white/85">
                {ar ? "وصفك (عربي):" : "Your prompt (Arabic):"}
              </p>
              <pre className="whitespace-pre-wrap" dir="rtl">
                {originalPrompt}
              </pre>
            </div>
          ) : null}

          {submittedPrompt ? (
            <div className="rounded-2xl border border-white/10 bg-[#141821] p-3 text-xs text-white/70">
              <p className="mb-1 font-semibold text-white/85">
                {ar
                  ? gpuOnly
                    ? "الوصف المُرسل للـ GPU (مترجم — إنجليزي):"
                    : "الوصف المُرسل (مترجم — إنجليزي):"
                  : gpuOnly
                    ? "Prompt sent to GPU (translated English):"
                    : "Prompt sent (translated English):"}
              </p>
              <pre className="whitespace-pre-wrap">{submittedPrompt}</pre>
            </div>
          ) : null}

          {info && !generating ? (
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-[#141821] p-3 text-xs text-white/75">
              {info}
            </pre>
          ) : null}
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
