"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Download,
  Home,
  Loader2,
  Lock,
  Mic,
  Plus,
  Pause,
  Play,
  Scissors,
  Trash2,
  Blend,
} from "lucide-react";
import Link from "next/link";
import { useLocale } from "@/components/veronix/LocaleProvider";
import { autoTranscribeAll, autoTranscribeCharacter, type TranscribeProgress } from "@/lib/edit-studio-transcribe";
import {
  characterId,
  cueId,
  cuesToScript,
  findActiveDialogueCue,
  formatCueTime,
  getPreviewDialogueCues,
  parseTimeInput,
  resolveCueTimelineDuration,
  sortDialogueCues,
} from "@/lib/edit-studio-dialogue";
import {
  subtitlePreviewClasses,
} from "@/lib/edit-studio-subtitles";
import type { EditStudioAspect, EditStudioFilter } from "@/lib/edit-studio-draft";
import {
  isEditStudioExportActive,
  runEditStudioExport,
  subscribeEditStudioExport,
} from "@/lib/edit-studio-export-job";
import {
  readStoredExportQuality,
  storeExportQuality,
  type EditStudioExportQuality,
} from "@/lib/edit-studio-export-quality";
import { openExportDeliveryTab } from "@/lib/edit-studio-ffmpeg";
import { publishEditExportToHome } from "@/lib/edit-studio-publish";
import {
  clipPlayDuration,
  clipSequenceDuration,
  clipTransitionOverlap,
  clipTrimEnd,
  globalTimeForClipPosition,
  locateClipAtGlobalTime,
  totalTimelineDuration,
} from "@/lib/edit-studio-sequence";
import {
  clearEditStudioTimeline,
  moveTimelineClip,
  readEditStudioTimeline,
  removeTimelineClip,
  setActiveTimelineClip,
  writeEditStudioTimeline,
  type EditStudioTimeline,
  type EditStudioTransition,
  type SubtitleBackground,
  type SubtitlePosition,
  type SubtitleSize,
  type DialogueCharacter,
  type DialogueCue,
  type TimelineClip,
} from "@/lib/edit-studio-timeline";

const FILTER_CSS: Record<EditStudioFilter, string> = {
  none: "none",
  cinematic: "contrast(1.12) saturate(1.18) brightness(0.96)",
  vintage: "sepia(0.38) contrast(1.08) saturate(0.82) brightness(1.02)",
  contrast: "contrast(1.38) saturate(1.05)",
  bw: "grayscale(1) contrast(1.08)",
};

const ASPECT_PREVIEW: Record<EditStudioAspect, string> = {
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16] max-h-[min(62vh,520px)]",
  "1:1": "aspect-square max-h-[min(52vh,440px)]",
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function formatTime(sec: number) {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

type SubtitleStylePreview = Partial<{
  subtitlePosition: SubtitlePosition;
  subtitleSize: SubtitleSize;
  subtitleBackground: SubtitleBackground;
}>;

/** Press and hold to preview on video; release to apply. */
function PressHoldChip({
  label,
  committed,
  previewing,
  onHoldStart,
  onHoldEnd,
  onCommit,
  variant = "default",
}: {
  label: string;
  committed: boolean;
  previewing: boolean;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  onCommit: () => void;
  variant?: "default" | "cyan";
}) {
  const holdingRef = useRef(false);
  const base =
    "rounded-full px-3 py-1.5 text-xs font-semibold transition select-none touch-none sm:text-sm";

  let stateClass = "border border-white/10 text-white/60";
  if (previewing) {
    stateClass =
      variant === "cyan"
        ? "bg-[#22f0ff]/30 text-[#22f0ff] ring-2 ring-[#22f0ff]/70 scale-[1.03]"
        : "bg-[#22f0ff]/20 text-white ring-2 ring-[#22f0ff]/55 scale-[1.03]";
  } else if (committed) {
    stateClass =
      variant === "cyan"
        ? "bg-[#22f0ff]/20 text-[#22f0ff] ring-1 ring-[#22f0ff]/40"
        : "bg-white text-black";
  }

  return (
    <button
      type="button"
      onPointerDown={(e) => {
        holdingRef.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        onHoldStart();
      }}
      onPointerUp={(e) => {
        if (holdingRef.current) onCommit();
        holdingRef.current = false;
        onHoldEnd();
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }}
      onPointerCancel={() => {
        holdingRef.current = false;
        onHoldEnd();
      }}
      onContextMenu={(e) => e.preventDefault()}
      className={`${base} ${stateClass} [-webkit-touch-callout:none]`}
    >
      {label}
    </button>
  );
}

function ClipTrimBar({
  clip,
  duration,
  onDuration,
  onPatch,
  labels,
  isActive,
  onSeek,
}: {
  clip: TimelineClip;
  duration: number;
  onDuration: (sec: number) => void;
  onPatch: (patch: Partial<TimelineClip>) => void;
  labels: {
    trimStart: string;
    trimEnd: string;
    trimLock: string;
  };
  isActive?: boolean;
  onSeek?: (time: number) => void;
}) {
  const locked = Boolean(clip.trimLocked);
  const trimStart = clip.trimStart;
  const trimEnd = clip.trimEnd > 0 ? clip.trimEnd : duration;
  const ready = duration > 0.1;

  return (
    <div className="space-y-1 border-t border-white/8 bg-black/40 px-1.5 py-1.5">
      {!ready ? (
        <video
          src={clip.videoUrl}
          preload="metadata"
          className="hidden"
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (!Number.isFinite(d) || d <= 0) return;
            onDuration(d);
            if (clip.trimEnd <= 0 || clip.trimEnd > d) {
              onPatch({ trimEnd: d, trimStart: clip.trimStart || 0, durationSec: d });
            }
          }}
        />
      ) : null}
      <label className="block text-[8px] leading-none text-white/45">
        <span className="flex justify-between gap-1 tabular-nums">
          <span>{labels.trimStart}</span>
          <span>{formatTime(trimStart)}</span>
        </span>
        <input
          type="range"
          min={0}
          max={Math.max(0, duration - 0.1)}
          step={0.05}
          value={ready ? trimStart : 0}
          disabled={!ready || locked}
          onChange={(e) => {
            const v = Number(e.target.value);
            const patch: Partial<TimelineClip> = { trimStart: v };
            if (v >= trimEnd) patch.trimEnd = Math.min(duration, v + 0.5);
            onPatch(patch);
            if (isActive) onSeek?.(v);
          }}
          className="mt-0.5 h-1 w-full accent-[#22f0ff] disabled:opacity-35"
        />
      </label>
      <label className="block text-[8px] leading-none text-white/45">
        <span className="flex justify-between gap-1 tabular-nums">
          <span>{labels.trimEnd}</span>
          <span>{formatTime(trimEnd)}</span>
        </span>
        <input
          type="range"
          min={Math.min(trimStart + 0.1, duration || 0.1)}
          max={duration || 1}
          step={0.05}
          value={ready ? trimEnd : 0}
          disabled={!ready || locked}
          onChange={(e) => {
            const v = Number(e.target.value);
            const patch: Partial<TimelineClip> = { trimEnd: v };
            if (v <= trimStart) patch.trimStart = Math.max(0, v - 0.5);
            onPatch(patch);
          }}
          className="mt-0.5 h-1 w-full accent-[#22f0ff] disabled:opacity-35"
        />
      </label>
      <label className="flex cursor-pointer items-center gap-1 text-[8px] font-semibold text-white/50">
        <input
          type="checkbox"
          checked={locked}
          onChange={(e) => onPatch({ trimLocked: e.target.checked })}
          className="h-3 w-3 shrink-0 rounded border-white/25 accent-[#22f0ff]"
        />
        <Lock
          className={`h-2.5 w-2.5 shrink-0 ${locked ? "text-[#22f0ff]" : "text-white/35"}`}
        />
        <span className={locked ? "text-[#22f0ff]/90" : undefined}>{labels.trimLock}</span>
      </label>
    </div>
  );
}

function TransitionBetween({
  value,
  onChange,
  label,
  options,
}: {
  value: EditStudioTransition;
  onChange: (value: EditStudioTransition) => void;
  label: string;
  options: { id: EditStudioTransition; label: string }[];
}) {
  return (
    <div className="flex w-8 shrink-0 flex-col items-center justify-center gap-0.5 self-start pt-[1.65rem]">
      <Blend className="h-3 w-3 shrink-0 text-[#7c5cff]/75" aria-hidden />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as EditStudioTransition)}
        className="w-[4rem] rounded-md border border-[#7c5cff]/25 bg-[#0d1118] px-0.5 py-0.5 text-center text-[7px] font-bold leading-tight text-white/75"
        aria-label={label}
        title={label}
      >
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function EditStudio() {
  const { t, dir } = useLocale();
  const videoRef = useRef<HTMLVideoElement>(null);
  const playSequenceRef = useRef(false);
  const pendingAutoPlayRef = useRef(false);
  const pendingSeekRef = useRef<number | null>(null);
  const advancingRef = useRef(false);
  const timelineRef = useRef<EditStudioTimeline>({ clips: [], activeClipId: null });
  const [timeline, setTimeline] = useState<EditStudioTimeline>({
    clips: [],
    activeClipId: null,
  });
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [exportDownloadUrl, setExportDownloadUrl] = useState<string | null>(null);
  const [exportDownloadName, setExportDownloadName] = useState<string | null>(null);
  const [exportPromptMeta, setExportPromptMeta] = useState<string | null>(null);
  const [exportAspectMeta, setExportAspectMeta] = useState<string | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishNote, setPublishNote] = useState<string | null>(null);
  const [publishedToHome, setPublishedToHome] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clipDurations, setClipDurations] = useState<Record<string, number>>({});
  const [extractingDialogue, setExtractingDialogue] = useState(false);
  const [extractingAll, setExtractingAll] = useState(false);
  const [extractNote, setExtractNote] = useState<string | null>(null);
  const [extractProgress, setExtractProgress] = useState<TranscribeProgress | null>(null);
  const [newCharacterName, setNewCharacterName] = useState("");
  const [previewFilter, setPreviewFilter] = useState<EditStudioFilter | null>(null);
  const [previewAspect, setPreviewAspect] = useState<EditStudioAspect | null>(null);
  const [previewSubtitle, setPreviewSubtitle] = useState<SubtitleStylePreview | null>(null);
  const [exportQuality, setExportQuality] = useState<EditStudioExportQuality>("standard");

  useEffect(() => {
    setTimeline(readEditStudioTimeline());
    setExportQuality(readStoredExportQuality());
  }, []);

  useEffect(() => {
    return subscribeEditStudioExport((job) => {
      setExporting(job.active);
      setExportDownloadUrl(job.downloadUrl);
      setExportDownloadName(job.downloadFilename);
      setExportPromptMeta(job.exportPrompt);
      setExportAspectMeta(job.exportAspect);
      if (job.phase === "done") {
        setExportNote(job.message);
        setError(null);
        setPublishNote(null);
      }
      if (job.active) {
        setPublishedToHome(false);
        setPublishNote(null);
      }
      if (job.phase === "error") {
        setError(job.error || t.editStudio.exportFailed);
        setExportDownloadUrl(null);
        setExportDownloadName(null);
      }
      if (job.phase === "idle" && !job.downloadUrl) {
        setExportDownloadUrl(null);
        setExportDownloadName(null);
      }
    });
  }, [t.editStudio.exportFailed]);

  useEffect(() => {
    timelineRef.current = timeline;
  }, [timeline]);

  const activeClip = useMemo(
    () => timeline.clips.find((c) => c.id === timeline.activeClipId) ?? null,
    [timeline],
  );

  useEffect(() => {
    setPreviewFilter(null);
    setPreviewAspect(null);
    setPreviewSubtitle(null);
  }, [activeClip?.id]);

  const persistClip = useCallback((clipId: string, patch: Partial<TimelineClip>) => {
    setTimeline((prev) => {
      const next = {
        ...prev,
        clips: prev.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)),
      };
      writeEditStudioTimeline(next);
      return next;
    });
  }, []);

  const selectClip = (clipId: string) => {
    playSequenceRef.current = false;
    pendingAutoPlayRef.current = false;
    setPlaying(false);
    setDuration(0);
    setCurrent(0);
    setTimeline(setActiveTimelineClip(clipId));
  };

  const advanceToNextClip = useCallback(() => {
    if (advancingRef.current) return false;
    advancingRef.current = true;
    const { clips, activeClipId } = timelineRef.current;
    const idx = clips.findIndex((c) => c.id === activeClipId);
    if (idx < 0 || idx >= clips.length - 1) {
      playSequenceRef.current = false;
      setPlaying(false);
      advancingRef.current = false;
      return false;
    }
    pendingAutoPlayRef.current = true;
    setTimeline(setActiveTimelineClip(clips[idx + 1]!.id));
    window.setTimeout(() => {
      advancingRef.current = false;
    }, 200);
    return true;
  }, []);

  const onMetadata = useCallback(() => {
    const el = videoRef.current;
    if (!el || !activeClip || !Number.isFinite(el.duration)) return;
    const d = el.duration;
    setDuration(d);
    setClipDurations((prev) => ({ ...prev, [activeClip.id]: d }));
    if (activeClip.trimEnd <= 0 || activeClip.trimEnd > d) {
      persistClip(activeClip.id, {
        trimEnd: d,
        trimStart: activeClip.trimStart || 0,
        durationSec: d,
      });
    }
  }, [activeClip, persistClip]);

  const clipDuration = useCallback(
    (clip: TimelineClip) => {
      const fromState = clipDurations[clip.id] ?? 0;
      const fromClip = clip.durationSec ?? 0;
      const fromVideo =
        clip.id === activeClip?.id &&
        videoRef.current &&
        Number.isFinite(videoRef.current.duration)
          ? videoRef.current.duration
          : 0;
      const fromUi = clip.id === activeClip?.id ? duration : 0;
      return Math.max(fromState, fromClip, fromVideo, fromUi);
    },
    [clipDurations, activeClip?.id, duration],
  );

  const ensureClipDuration = useCallback(
    (clip: TimelineClip): Promise<number> => {
      const known = clipDuration(clip);
      if (known > 1) return Promise.resolve(clipPlayDuration(clip, known));
      return new Promise((resolve) => {
        const v = document.createElement("video");
        v.preload = "metadata";
        v.src = clip.videoUrl;
        const finish = (sec: number) => {
          if (sec > 0) {
            setClipDurations((prev) => ({ ...prev, [clip.id]: sec }));
            persistClip(clip.id, {
              durationSec: sec,
              trimEnd: clip.trimEnd > 0 ? clip.trimEnd : sec,
            });
          }
          resolve(clipPlayDuration(clip, sec > 0 ? sec : Math.max(known, 30)));
        };
        v.onloadedmetadata = () => {
          const d = v.duration;
          finish(Number.isFinite(d) && d > 0 ? d : 0);
        };
        v.onerror = () => finish(0);
      });
    },
    [clipDuration, persistClip],
  );

  const activeClipIndex = useMemo(
    () => timeline.clips.findIndex((c) => c.id === timeline.activeClipId),
    [timeline.clips, timeline.activeClipId],
  );

  const totalSequenceDuration = useMemo(
    () => totalTimelineDuration(timeline.clips, clipDuration),
    [timeline.clips, clipDurations, clipDuration, duration],
  );

  const globalPlaybackTime = useMemo(() => {
    if (!activeClip || activeClipIndex < 0) return 0;
    return globalTimeForClipPosition(
      timeline.clips,
      clipDuration,
      activeClipIndex,
      current,
    );
  }, [activeClip, activeClipIndex, current, timeline.clips, clipDuration]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !activeClip) return;
    const activeDur = clipDuration(activeClip);
    const trimStart = activeClip.trimStart;
    const trimEnd = clipTrimEnd(activeClip, activeDur);
    const onTime = () => {
      setCurrent(el.currentTime);
      if (trimEnd > 0 && el.currentTime >= trimEnd - 0.08) {
        if (playSequenceRef.current && timelineRef.current.clips.length > 1) {
          if (!advanceToNextClip()) {
            el.pause();
            setPlaying(false);
          }
        } else {
          el.pause();
          setPlaying(false);
          playSequenceRef.current = false;
          try {
            el.currentTime = trimStart;
          } catch {
            // ignore
          }
        }
      }
    };
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, [activeClip, duration, clipDuration, advanceToNextClip]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !activeClip) return;

    const startAutoPlay = () => {
      if (!pendingAutoPlayRef.current) return;
      pendingAutoPlayRef.current = false;
      try {
        el.currentTime = pendingSeekRef.current ?? activeClip.trimStart;
        pendingSeekRef.current = null;
        setCurrent(el.currentTime);
      } catch {
        el.currentTime = activeClip.trimStart;
        setCurrent(activeClip.trimStart);
      }
      void el
        .play()
        .then(() => setPlaying(true))
        .catch(() => {
          setPlaying(false);
          playSequenceRef.current = false;
        });
    };

    if (pendingAutoPlayRef.current) {
      if (el.readyState >= 2) startAutoPlay();
      else el.addEventListener("loadeddata", startAutoPlay, { once: true });
      return () => el.removeEventListener("loadeddata", startAutoPlay);
    }

    const pendingSeek = pendingSeekRef.current;
    if (pendingSeek !== null) {
      pendingSeekRef.current = null;
      try {
        el.currentTime = pendingSeek;
        setCurrent(pendingSeek);
      } catch {
        setCurrent(activeClip.trimStart);
      }
      return;
    }

    if (!playSequenceRef.current && !playing) {
      el.pause();
      try {
        el.currentTime = activeClip.trimStart;
        setCurrent(activeClip.trimStart);
      } catch {
        setCurrent(0);
      }
    }
  }, [activeClip?.id, activeClip?.videoUrl, activeClip?.trimStart, playing]);

  const pausePlaybackForExport = useCallback(() => {
    playSequenceRef.current = false;
    pendingAutoPlayRef.current = false;
    videoRef.current?.pause();
    setPlaying(false);
  }, []);

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el || !timeline.clips.length || !activeClip) return;

    if (!el.paused && playing) {
      playSequenceRef.current = false;
      pendingAutoPlayRef.current = false;
      el.pause();
      setPlaying(false);
      return;
    }

    playSequenceRef.current = timeline.clips.length > 1;
    pendingAutoPlayRef.current = false;
    try {
      el.currentTime = activeClip.trimStart;
      setCurrent(activeClip.trimStart);
    } catch {
      setCurrent(0);
    }
    void el
      .play()
      .then(() => setPlaying(true))
      .catch(() => {
        setPlaying(false);
        playSequenceRef.current = false;
      });
  };

  const seekTo = (time: number) => {
    const el = videoRef.current;
    if (!el || !activeClip) return;
    playSequenceRef.current = false;
    pendingAutoPlayRef.current = false;
    const activeDur = clipDuration(activeClip);
    const trimStart = activeClip.trimStart;
    const trimEnd = clipTrimEnd(activeClip, activeDur);
    el.currentTime = clamp(time, trimStart, trimEnd);
    setCurrent(el.currentTime);
  };

  const seekGlobalTime = useCallback(
    (target: number) => {
      const clips = timelineRef.current.clips;
      if (!clips.length) return;
      playSequenceRef.current = false;
      pendingAutoPlayRef.current = false;

      const located = locateClipAtGlobalTime(
        clips,
        clipDuration,
        clamp(target, 0, totalSequenceDuration),
      );
      const clip = clips[located.clipIndex]!;
      const seekTime = located.inTransition
        ? clipTrimEnd(clip, clipDuration(clip)) - clipTransitionOverlap(clip)
        : located.localTime;

      if (clip.id !== timelineRef.current.activeClipId) {
        pendingSeekRef.current = seekTime;
        setTimeline(setActiveTimelineClip(clip.id));
      } else {
        seekTo(seekTime);
      }
    },
    [clipDuration, totalSequenceDuration],
  );

  const extractErrorMessage = useCallback(
    (code?: string) => {
      if (code === "no_audio") return t.editStudio.noAudioTrack;
      if (code === "character_required") return t.editStudio.selectCharacterFirst;
      if (code === "no_dialogue") return t.editStudio.noDialogueInClip;
      if (code === "no_dialogue_for_character") return t.editStudio.noDialogueForCharacter;
      if (code?.trim()) return code;
      return t.editStudio.extractFailed;
    },
    [
      t.editStudio.extractFailed,
      t.editStudio.noAudioTrack,
      t.editStudio.noDialogueInClip,
      t.editStudio.noDialogueForCharacter,
      t.editStudio.selectCharacterFirst,
    ],
  );

  const activeCharacters = activeClip?.dialogueCharacters ?? [];
  const selectedCharacter = useMemo(() => {
    if (!activeClip) return null;
    const id = activeClip.activeDialogueCharacterId;
    return activeCharacters.find((c) => c.id === id) ?? activeCharacters[0] ?? null;
  }, [activeClip, activeCharacters]);

  const addCharacter = useCallback(() => {
    if (!activeClip) return;
    const name = newCharacterName.trim();
    if (!name) return;
    const exists = activeCharacters.some(
      (c) => c.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (exists) {
      setExtractNote(t.editStudio.characterExists);
      return;
    }
    const next: DialogueCharacter = { id: characterId(), name };
    const characters = [...activeCharacters, next];
    persistClip(activeClip.id, {
      dialogueCharacters: characters,
      activeDialogueCharacterId: next.id,
    });
    setNewCharacterName("");
    setExtractNote(null);
  }, [activeClip, activeCharacters, newCharacterName, persistClip, t.editStudio.characterExists]);

  const removeCharacter = useCallback(
    (charId: string) => {
      if (!activeClip) return;
      const removed = activeCharacters.find((c) => c.id === charId);
      const characters = activeCharacters.filter((c) => c.id !== charId);
      const cues = (activeClip.dialogueCues ?? []).filter(
        (c) => c.speaker.trim() !== removed?.name.trim(),
      );
      let activeDialogueCharacterId = activeClip.activeDialogueCharacterId;
      if (activeDialogueCharacterId === charId) {
        activeDialogueCharacterId = characters[0]?.id ?? null;
      }
      persistClip(activeClip.id, {
        dialogueCharacters: characters,
        activeDialogueCharacterId,
        dialogueCues: cues,
        dialogueText: cuesToScript(cues),
      });
    },
    [activeClip, activeCharacters, persistClip],
  );

  const selectCharacter = useCallback(
    (charId: string) => {
      if (!activeClip) return;
      persistClip(activeClip.id, { activeDialogueCharacterId: charId });
      setExtractNote(null);
    },
    [activeClip, persistClip],
  );

  const extractProgressLabel = useMemo(() => {
    if (!extractProgress) return null;
    if (extractProgress.phase === "audio") return t.editStudio.extractPreparingAudio;
    return t.editStudio.extractTranscribingProgress
      .replace("{current}", String(extractProgress.current))
      .replace("{total}", String(extractProgress.total));
  }, [extractProgress, t.editStudio.extractPreparingAudio, t.editStudio.extractTranscribingProgress]);

  const extractDialogueForCharacter = useCallback(
    async (
      clip: TimelineClip,
      characterName: string,
      durationHint: number,
      voiceIndex: number,
    ) => {
      setExtractNote(null);
      setExtractProgress({ phase: "audio" });
      const result = await autoTranscribeCharacter(
        clip,
        characterName,
        durationHint,
        voiceIndex,
        setExtractProgress,
      );
      if (result.error && !result.cues.length) {
        setExtractNote(extractErrorMessage(result.error));
        return { ok: false as const, usedFallback: false };
      }
      persistClip(clip.id, {
        dialogueCues: result.cues,
        dialogueText: result.text,
      });
      return { ok: true as const, usedFallback: Boolean(result.usedFallback) };
    },
    [extractErrorMessage, persistClip],
  );

  const extractAllSpeech = useCallback(
    async (clip: TimelineClip) => {
      setExtractNote(null);
      setExtractProgress({ phase: "audio" });
      const dur = await ensureClipDuration(clip);
      const result = await autoTranscribeAll(clip, dur, setExtractProgress);
      if (result.error && !result.cues.length) {
        setExtractNote(extractErrorMessage(result.error));
        return false;
      }
      persistClip(clip.id, {
        dialogueCues: result.cues,
        dialogueText: result.text,
      });
      return true;
    },
    [ensureClipDuration, extractErrorMessage, persistClip],
  );

  const extractActiveDialogue = useCallback(async () => {
    if (!activeClip || !selectedCharacter || extractingDialogue || extractingAll) return;
    setExtractingDialogue(true);
    setExtractNote(null);
    const dur = await ensureClipDuration(activeClip);
    const voiceIndex = activeCharacters.findIndex((c) => c.id === selectedCharacter.id);
    try {
      const out = await extractDialogueForCharacter(
        activeClip,
        selectedCharacter.name,
        dur,
        Math.max(0, voiceIndex),
      );
      if (out.ok) {
        setExtractNote(
          out.usedFallback
            ? t.editStudio.extractFallback
            : t.editStudio.extractDoneForCharacter.replace("{name}", selectedCharacter.name),
        );
      }
    } finally {
      setExtractingDialogue(false);
      setExtractProgress(null);
    }
  }, [
    activeClip,
    activeCharacters,
    ensureClipDuration,
    extractDialogueForCharacter,
    extractingAll,
    extractingDialogue,
    selectedCharacter,
    t.editStudio.extractDoneForCharacter,
    t.editStudio.extractFallback,
  ]);

  const extractActiveAllSpeech = useCallback(async () => {
    if (!activeClip || extractingDialogue || extractingAll) return;
    setExtractingAll(true);
    setExtractNote(null);
    try {
      const ok = await extractAllSpeech(activeClip);
      if (ok) setExtractNote(t.editStudio.extractAllSpeechDone);
    } finally {
      setExtractingAll(false);
      setExtractProgress(null);
    }
  }, [
    activeClip,
    extractAllSpeech,
    extractingAll,
    extractingDialogue,
    t.editStudio.extractAllSpeechDone,
  ]);

  const extractAllCharacters = useCallback(async () => {
    if (!activeClip || !activeCharacters.length || extractingDialogue || extractingAll) return;
    setExtractingAll(true);
    setExtractNote(null);
    setExtractProgress({ phase: "audio" });
    let okCount = 0;
    let workingClip = activeClip;
    const dur = await ensureClipDuration(activeClip);
    try {
      for (let i = 0; i < activeCharacters.length; i += 1) {
        const character = activeCharacters[i]!;
        const result = await autoTranscribeCharacter(
          workingClip,
          character.name,
          dur,
          i,
          setExtractProgress,
        );
        if (result.cues.length) {
          workingClip = {
            ...workingClip,
            dialogueCues: result.cues,
            dialogueText: result.text,
          };
          okCount += 1;
        }
      }
      if (okCount === 0) {
        setExtractNote(t.editStudio.extractFailed);
      } else {
        persistClip(activeClip.id, {
          dialogueCues: workingClip.dialogueCues,
          dialogueText: workingClip.dialogueText,
        });
        setExtractNote(
          okCount === activeCharacters.length
            ? t.editStudio.extractAllDone
            : `${t.editStudio.extractAllDone} (${okCount}/${activeCharacters.length})`,
        );
      }
    } finally {
      setExtractingAll(false);
      setExtractProgress(null);
    }
  }, [
    activeClip,
    activeCharacters,
    ensureClipDuration,
    extractingAll,
    extractingDialogue,
    persistClip,
    t.editStudio.extractAllDone,
    t.editStudio.extractFailed,
  ]);

  const activePlayDuration = useMemo(() => {
    if (!activeClip) return 0;
    return clipPlayDuration(activeClip, clipDuration(activeClip));
  }, [activeClip, clipDuration]);

  const cueTimelineMax = useMemo(() => {
    if (!activeClip) return 60;
    return resolveCueTimelineDuration(
      activeClip,
      activePlayDuration,
      activeClip.dialogueCues,
    );
  }, [activeClip, activePlayDuration]);

  const playheadRelativeSec = useMemo(() => {
    if (!activeClip) return 0;
    return Math.max(0, current - (activeClip.trimStart || 0));
  }, [activeClip, current]);

  const editableDialogueCues = useMemo(() => {
    if (!activeClip) return [];
    return sortDialogueCues(activeClip.dialogueCues ?? []);
  }, [activeClip]);

  const previewDialogueCues = useMemo(() => {
    if (!activeClip) return [];
    return getPreviewDialogueCues(activeClip);
  }, [activeClip]);

  const activeDialogueCue = useMemo(() => {
    if (!activeClip) return null;
    return findActiveDialogueCue(previewDialogueCues, playheadRelativeSec);
  }, [activeClip, previewDialogueCues, playheadRelativeSec]);

  const updateDialogueCue = useCallback(
    (cueId: string, patch: Partial<DialogueCue>) => {
      if (!activeClip) return;
      const base = activeClip.dialogueCues ?? [];
      const cues = sortDialogueCues(
        base.map((c) => (c.id === cueId ? { ...c, ...patch } : c)),
      );
      persistClip(activeClip.id, {
        dialogueCues: cues,
        dialogueText: cuesToScript(cues.filter((c) => c.text.trim())),
      });
    },
    [activeClip, persistClip],
  );

  const addManualDialogueCue = useCallback(
    (atPlayhead: boolean) => {
      if (!activeClip) return;
      const rel = atPlayhead ? playheadRelativeSec : 0;
      const end = Math.min(
        rel + 4,
        activePlayDuration > 0 ? activePlayDuration : rel + 4,
      );
      const cue: DialogueCue = {
        id: cueId(),
        speaker: selectedCharacter?.name ?? "",
        text: "",
        startSec: rel,
        endSec: Math.max(rel + 0.5, end),
      };
      const cues = sortDialogueCues([...(activeClip.dialogueCues ?? []), cue]);
      persistClip(activeClip.id, { dialogueCues: cues, dialogueText: cuesToScript(cues) });
      setExtractNote(null);
    },
    [activeClip, activePlayDuration, persistClip, playheadRelativeSec, selectedCharacter?.name],
  );

  const removeDialogueCue = useCallback(
    (id: string) => {
      if (!activeClip) return;
      const cues = (activeClip.dialogueCues ?? []).filter((c) => c.id !== id);
      persistClip(activeClip.id, {
        dialogueCues: cues,
        dialogueText: cuesToScript(cues),
      });
    },
    [activeClip, persistClip],
  );

  const setCueFromPlayhead = useCallback(
    (id: string, field: "startSec" | "endSec") => {
      const cue = (activeClip?.dialogueCues ?? []).find((c) => c.id === id);
      if (!cue) return;
      const t = playheadRelativeSec;
      if (field === "startSec") {
        const end = Math.max(t + 0.2, cue.endSec);
        updateDialogueCue(id, { startSec: t, endSec: end });
      } else {
        const start = Math.min(cue.startSec, t - 0.2);
        updateDialogueCue(id, { startSec: start, endSec: Math.max(start + 0.2, t) });
      }
    },
    [activeClip?.dialogueCues, playheadRelativeSec, updateDialogueCue],
  );

  const applyCueTimeInput = useCallback(
    (id: string, field: "startSec" | "endSec", raw: string) => {
      const sec = parseTimeInput(raw);
      if (sec === null) return;
      const max = cueTimelineMax;
      const clamped = Math.min(Math.max(0, sec), max);
      const cue = (activeClip?.dialogueCues ?? []).find((c) => c.id === id);
      if (!cue) return;
      if (field === "startSec") {
        const end = Math.max(clamped + 0.2, cue.endSec);
        updateDialogueCue(id, { startSec: clamped, endSec: Math.min(end, max) });
      } else {
        const start = Math.min(cue.startSec, clamped - 0.2);
        updateDialogueCue(id, {
          startSec: start,
          endSec: Math.max(start + 0.2, Math.min(clamped, max)),
        });
      }
    },
    [activeClip?.dialogueCues, cueTimelineMax, updateDialogueCue],
  );

  const filterOptions = useMemo(
    () =>
      (
        [
          ["none", t.editStudio.filterNone],
          ["cinematic", t.editStudio.filterCinematic],
          ["vintage", t.editStudio.filterVintage],
          ["contrast", t.editStudio.filterContrast],
          ["bw", t.editStudio.filterBw],
        ] as const
      ).map(([id, label]) => ({ id, label })),
    [t.editStudio],
  );

  const transitionOptions = useMemo(
    () =>
      (
        [
          ["none", t.editStudio.transitionNone],
          ["fade", t.editStudio.transitionFade],
          ["dissolve", t.editStudio.transitionDissolve],
          ["wipe", t.editStudio.transitionWipe],
        ] as const
      ).map(([id, label]) => ({ id, label })),
    [t.editStudio],
  );

  const exportLabels = useMemo(
    () => ({
      loadingClips:
        dir === "rtl" ? "جاري تحميل المقاطع…" : "Loading clips…",
      exporting: t.editStudio.exporting,
      serverExporting: t.editStudio.exportServerProcessing,
      done: t.editStudio.exportDone,
      doneTab: t.editStudio.exportDoneNewTab,
      failed: t.editStudio.exportFailed,
      audioFailed: t.editStudio.exportAudioFailed,
      memoryFailed: t.editStudio.exportMemoryFailed,
      backgroundHint:
        dir === "rtl"
          ? "يمكنك مغادرة الصفحة — التصدير يستمر"
          : "You can leave — export continues",
    }),
    [dir, t.editStudio],
  );

  const exportMeta = useMemo(() => {
    const clip = activeClip || timeline.clips[0];
    const prompt =
      clip?.prompt?.trim() ||
      clip?.dialogueText?.trim() ||
      timeline.clips.map((c) => c.prompt?.trim()).find(Boolean) ||
      "";
    const aspect = clip?.exportAspect || "16:9";
    return { prompt, aspect };
  }, [activeClip, timeline.clips]);

  const handlePublishToHome = async () => {
    if (!exportDownloadUrl || publishBusy || publishedToHome) return;
    setPublishBusy(true);
    setPublishNote(null);
    try {
      const res = await fetch(exportDownloadUrl);
      const blob = await res.blob();
      const result = await publishEditExportToHome({
        blob,
        filename: exportDownloadName || "vyronix-export.mp4",
        prompt: exportPromptMeta || exportMeta.prompt || undefined,
        aspectRatio: exportAspectMeta || exportMeta.aspect,
      });
      if (result.ok) {
        setPublishedToHome(true);
        setPublishNote(t.editStudio.publishDone);
      } else {
        setPublishNote(result.error || t.editStudio.publishFailed);
      }
    } catch {
      setPublishNote(t.editStudio.publishFailed);
    } finally {
      setPublishBusy(false);
    }
  };

  const handleMergeExport = () => {
    if (!timeline.clips.length || isEditStudioExportActive()) return;
    pausePlaybackForExport();
    setExportNote(null);
    setError(null);
    runEditStudioExport({
      clips: timeline.clips,
      filename: `veronix-merge-${Date.now()}.mp4`,
      merge: true,
      labels: exportLabels,
      deliveryTab: openExportDeliveryTab(),
      quality: exportQuality,
      exportPrompt: exportMeta.prompt,
      exportAspect: exportMeta.aspect,
    });
  };

  const handleExportActive = () => {
    if (!activeClip || isEditStudioExportActive()) return;
    pausePlaybackForExport();
    setExportNote(null);
    setError(null);
    runEditStudioExport({
      clips: [activeClip],
      filename: `veronix-clip-${Date.now()}.mp4`,
      merge: false,
      labels: exportLabels,
      deliveryTab: openExportDeliveryTab(),
      quality: exportQuality,
      exportPrompt: exportMeta.prompt,
      exportAspect: exportMeta.aspect,
    });
  };

  const clearAll = () => {
    clearEditStudioTimeline();
    setTimeline({ clips: [], activeClipId: null });
    setError(t.editStudio.noVideo);
  };

  if (!timeline.clips.length) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6">
        <Scissors className="mx-auto h-10 w-10 text-[#22f0ff]/60" />
        <p className="mt-4 text-sm text-white/55">{error || t.editStudio.noVideo}</p>
        <p className="mt-2 text-xs text-white/35">{t.editStudio.noVideoHint}</p>
      </div>
    );
  }

  const trimStart = activeClip?.trimStart ?? 0;
  const trimEnd =
    activeClip && activeClip.trimEnd > 0 ? activeClip.trimEnd : duration;
  const clipLocalDuration = Math.max(0.1, trimEnd - trimStart);
  const relativeCurrent = clamp(current - trimStart, 0, clipLocalDuration);
  const showGlobalTime = timeline.clips.length > 1;
  const barCurrent = showGlobalTime ? globalPlaybackTime : relativeCurrent;
  const barTotal = showGlobalTime ? totalSequenceDuration : clipLocalDuration;
  const progressPct = barTotal > 0 ? (barCurrent / barTotal) * 100 : 0;
  const activeFilter = activeClip?.filter ?? "none";
  const activeAspect = activeClip?.exportAspect ?? "16:9";
  const displayFilter = previewFilter ?? activeFilter;
  const displayAspect = previewAspect ?? activeAspect;
  const subtitlePreview = activeClip
    ? subtitlePreviewClasses(activeClip, previewSubtitle ?? undefined)
    : null;
  const previewSpeaker = activeDialogueCue?.speaker?.trim() ?? "";
  const previewText = activeDialogueCue?.text?.trim() ?? "";
  const displayPreviewText = previewText;
  const displayPreviewSpeaker = previewSpeaker;
  const isVisualPreview =
    previewFilter !== null || previewAspect !== null || previewSubtitle !== null;

  const aspectFilterPanel = activeClip ? (
    <section className="rounded-2xl border border-[#22f0ff]/30 bg-[#141821] p-4 ring-1 ring-[#22f0ff]/10">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#22f0ff]/90">
        {t.editStudio.lookAndFeel}
      </p>
      <p className="mb-4 text-[11px] leading-relaxed text-white/55">{t.editStudio.pressHoldHint}</p>
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold text-white/50">{t.editStudio.aspect}</p>
          <div className="flex flex-wrap gap-2">
            {(["16:9", "9:16", "1:1"] as const).map((id) => (
              <PressHoldChip
                key={id}
                label={id}
                variant="cyan"
                committed={activeAspect === id}
                previewing={previewAspect === id}
                onHoldStart={() => setPreviewAspect(id)}
                onHoldEnd={() => setPreviewAspect(null)}
                onCommit={() => persistClip(activeClip.id, { exportAspect: id })}
              />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-[11px] font-semibold text-white/50">{t.editStudio.filters}</p>
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((opt) => (
              <PressHoldChip
                key={opt.id}
                label={opt.label}
                committed={activeFilter === opt.id}
                previewing={previewFilter === opt.id}
                onHoldStart={() => setPreviewFilter(opt.id)}
                onHoldEnd={() => setPreviewFilter(null)}
                onCommit={() => persistClip(activeClip.id, { filter: opt.id })}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  ) : null;

  const timelineStrip = (
    <section className="rounded-2xl border border-white/10 bg-[#141821] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
          {t.editStudio.timeline}
        </p>
        <span className="text-[11px] text-white/40">
          {t.editStudio.clipCount.replace("{n}", String(timeline.clips.length))}
        </span>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {timeline.clips.map((clip, index) => {
          const active = clip.id === timeline.activeClipId;
          return (
            <div key={clip.id} className="flex shrink-0 items-start">
              <div
                className={`flex w-[9.25rem] shrink-0 flex-col overflow-hidden rounded-xl border transition ${
                  active
                    ? "border-[#22f0ff]/50 ring-1 ring-[#22f0ff]/30"
                    : "border-white/10"
                }`}
              >
                <button
                  type="button"
                  onClick={() => selectClip(clip.id)}
                  className="relative aspect-video w-full shrink-0 overflow-hidden bg-black/60"
                >
                  {clip.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={clip.posterUrl}
                      alt=""
                      className="h-full w-full object-cover object-center"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-white/30">
                      <Clapperboard className="h-6 w-6" />
                    </div>
                  )}
                  <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                </button>
                <div className="flex items-center justify-between gap-0.5 border-t border-white/8 bg-black/30 p-1">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => setTimeline(moveTimelineClip(clip.id, -1))}
                    className="rounded p-1 text-white/70 disabled:opacity-30"
                    aria-label={t.editStudio.moveBack}
                    title={t.editStudio.moveBack}
                  >
                    {dir === "rtl" ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronLeft className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={index === timeline.clips.length - 1}
                    onClick={() => setTimeline(moveTimelineClip(clip.id, 1))}
                    className="rounded p-1 text-white/70 disabled:opacity-30"
                    aria-label={t.editStudio.moveForward}
                    title={t.editStudio.moveForward}
                  >
                    {dir === "rtl" ? (
                      <ChevronLeft className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeline(removeTimelineClip(clip.id))}
                    className="rounded p-1 text-rose-300/90"
                    aria-label={t.editStudio.deleteClip}
                    title={t.editStudio.deleteClip}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <ClipTrimBar
                  clip={clip}
                  duration={clipDuration(clip)}
                  isActive={active}
                  onSeek={seekTo}
                  onDuration={(d) => {
                    setClipDurations((prev) => ({ ...prev, [clip.id]: d }));
                  }}
                  onPatch={(patch) => persistClip(clip.id, patch)}
                  labels={{
                    trimStart: t.editStudio.trimStart,
                    trimEnd: t.editStudio.trimEnd,
                    trimLock: t.editStudio.trimLock,
                  }}
                />
              </div>
              {index < timeline.clips.length - 1 ? (
                <TransitionBetween
                  value={clip.transitionAfter ?? "none"}
                  onChange={(v) => persistClip(clip.id, { transitionAfter: v })}
                  label={t.editStudio.transition}
                  options={transitionOptions}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 pb-8 pt-2 sm:px-6">
      {timelineStrip}

      {activeClip ? (
        <>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#141821]">
            <div
              className={`relative mx-auto w-full bg-black ${ASPECT_PREVIEW[displayAspect]}`}
            >
              <video
                ref={videoRef}
                key={activeClip.id}
                src={activeClip.videoUrl}
                className="h-full w-full object-contain"
                style={{ filter: FILTER_CSS[displayFilter] }}
                playsInline
                preload="metadata"
                onLoadedMetadata={onMetadata}
                onPlay={() => setPlaying(true)}
                onPause={() => {
                  if (pendingAutoPlayRef.current) return;
                  setPlaying(false);
                }}
              />
              {displayPreviewText && subtitlePreview ? (
                <div className={subtitlePreview.wrap} dir="rtl">
                  {displayPreviewSpeaker ? (
                    <p className={subtitlePreview.speaker}>{displayPreviewSpeaker}</p>
                  ) : null}
                  <p className={subtitlePreview.text}>{displayPreviewText}</p>
                </div>
              ) : null}
              {isVisualPreview ? (
                <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-full bg-[#22f0ff] px-2.5 py-1 text-[10px] font-bold text-[#0b0d12] shadow-lg">
                  {t.editStudio.previewBadge}
                </div>
              ) : null}

              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                <button
                  type="button"
                  onClick={togglePlay}
                  className={`pointer-events-auto flex items-center justify-center rounded-full shadow-lg transition active:scale-95 ${
                    playing
                      ? "h-14 w-14 bg-black/55 text-white ring-1 ring-white/30"
                      : "h-16 w-16 bg-white/90 text-black"
                  }`}
                  aria-label={playing ? t.assets.pause : t.assets.play}
                >
                  {playing ? (
                    <Pause className="h-6 w-6" fill="currentColor" />
                  ) : (
                    <Play className="h-7 w-7 translate-x-0.5" fill="currentColor" />
                  )}
                </button>
              </div>

              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/45 to-transparent px-3 pb-3 pt-10">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.1}
                  value={progressPct}
                  disabled={barTotal <= 0.1}
                  onChange={(e) => {
                    const ratio = Number(e.target.value) / 100;
                    if (showGlobalTime) {
                      seekGlobalTime(ratio * barTotal);
                    } else {
                      seekTo(trimStart + ratio * clipLocalDuration);
                    }
                  }}
                  className="pointer-events-auto mb-1.5 h-1 w-full accent-[#22f0ff] disabled:opacity-40"
                  aria-label={t.editStudio.subtitleClock}
                />
                <div className="flex items-center justify-between gap-2 text-[10px] tabular-nums text-white/85">
                  <span>
                    {formatTime(barCurrent)} / {formatTime(barTotal)}
                  </span>
                  {showGlobalTime && activeClipIndex >= 0 ? (
                    <span className="font-semibold text-white/55">
                      {activeClipIndex + 1}/{timeline.clips.length}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            {activeClip.prompt ? (
              <p className="border-t border-white/8 px-3 py-2 text-[11px] leading-relaxed text-white/45 line-clamp-2">
                {activeClip.prompt}
              </p>
            ) : null}
          </div>

          <p className="text-center text-[10px] tabular-nums text-white/40">
            {t.editStudio.subtitleClock}: {formatCueTime(playheadRelativeSec)}
            {activeDialogueCue
              ? ` · ${formatCueTime(activeDialogueCue.startSec)}–${formatCueTime(activeDialogueCue.endSec)}`
              : previewDialogueCues.length
                ? ` · ${t.editStudio.subtitleWaiting}`
                : ""}
          </p>

          {aspectFilterPanel}

          <section className="rounded-2xl border border-[#22f0ff]/25 bg-[#141821] p-4" dir={dir}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/45">
              {t.editStudio.subtitlesTitle}
            </p>

            <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="mb-2 text-[11px] leading-relaxed text-white/50">
                {t.editStudio.extractAllHint}
              </p>
              <button
                type="button"
                disabled={extractingDialogue || extractingAll}
                onClick={() => void extractActiveAllSpeech()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500/20 px-4 py-2.5 text-sm font-semibold text-emerald-200 ring-1 ring-emerald-500/35 disabled:opacity-40"
              >
                {extractingDialogue && !extractingAll ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
                {extractingDialogue && !extractingAll
                  ? t.editStudio.extractingDialogue
                  : t.editStudio.extractAllSpeech}
              </button>
              {extractProgressLabel ? (
                <p className="mt-2 text-center text-[11px] text-emerald-200/80">
                  {extractProgressLabel}
                </p>
              ) : null}
            </div>

            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-white/35">
              {t.editStudio.manualDialogueLabel}
            </p>
            <p className="mb-3 text-[11px] leading-relaxed text-white/40">
              {t.editStudio.manualDialogueHint}
            </p>

            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => addManualDialogueCue(false)}
                className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                {t.editStudio.addDialogueLine}
              </button>
              <button
                type="button"
                onClick={() => addManualDialogueCue(true)}
                className="inline-flex items-center gap-1 rounded-lg bg-[#22f0ff]/15 px-3 py-1.5 text-xs font-semibold text-[#22f0ff] ring-1 ring-[#22f0ff]/30"
              >
                <Plus className="h-3.5 w-3.5" />
                {t.editStudio.addDialogueAtPlayhead}
              </button>
            </div>

            <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {editableDialogueCues.length ? (
                editableDialogueCues.map((cue) => (
                  <div
                    key={cue.id}
                    className={`rounded-xl border p-3 transition ${
                      activeDialogueCue?.id === cue.id
                        ? "border-[#22f0ff]/40 bg-[#22f0ff]/5"
                        : "border-white/10 bg-[#0d1118]"
                    }`}
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[11px] tabular-nums text-[#22f0ff]/90">
                        {formatCueTime(cue.startSec)} – {formatCueTime(cue.endSec)}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => setCueFromPlayhead(cue.id, "startSec")}
                          className="rounded-lg bg-white/8 px-2 py-1 text-[10px] font-semibold text-white/70"
                        >
                          {t.editStudio.setStartToPlayhead}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCueFromPlayhead(cue.id, "endSec")}
                          className="rounded-lg bg-white/8 px-2 py-1 text-[10px] font-semibold text-white/70"
                        >
                          {t.editStudio.setEndToPlayhead}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeDialogueCue(cue.id)}
                          className="rounded p-1.5 text-white/40 hover:text-rose-300"
                          aria-label={t.editStudio.deleteDialogueLine}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <label className="mb-2 block text-[10px] text-white/45">
                      {t.editStudio.dialogueStartTime} — {formatCueTime(cue.startSec)}
                      <input
                        type="range"
                        min={0}
                        max={cueTimelineMax}
                        step={0.05}
                        value={cue.startSec}
                        onChange={(e) => {
                          const s = Number(e.target.value);
                          const end = Math.max(s + 0.2, cue.endSec);
                          updateDialogueCue(cue.id, { startSec: s, endSec: end });
                        }}
                        className="mt-1 h-2 w-full accent-[#22f0ff]"
                      />
                    </label>
                    <label className="mb-2 block text-[10px] text-white/45">
                      {t.editStudio.dialogueEndTime} — {formatCueTime(cue.endSec)}
                      <input
                        type="range"
                        min={Math.min(cue.startSec + 0.2, cueTimelineMax)}
                        max={cueTimelineMax}
                        step={0.05}
                        value={cue.endSec}
                        onChange={(e) =>
                          updateDialogueCue(cue.id, { endSec: Number(e.target.value) })
                        }
                        className="mt-1 h-2 w-full accent-[#22f0ff]"
                      />
                    </label>

                    <div className="mb-2 flex flex-wrap items-end gap-2">
                      <label className="flex flex-col gap-0.5 text-[10px] text-white/45">
                        {t.editStudio.dialogueStartTime}
                        <input
                          key={`${cue.id}-s-${cue.startSec}`}
                          defaultValue={formatCueTime(cue.startSec)}
                          onBlur={(e) =>
                            applyCueTimeInput(cue.id, "startSec", e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.currentTarget.blur();
                            }
                          }}
                          placeholder="0:00"
                          dir="ltr"
                          className="w-[5rem] rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs font-mono text-white focus:border-[#22f0ff]/35 focus:outline-none"
                        />
                      </label>
                      <label className="flex flex-col gap-0.5 text-[10px] text-white/45">
                        {t.editStudio.dialogueEndTime}
                        <input
                          key={`${cue.id}-e-${cue.endSec}`}
                          defaultValue={formatCueTime(cue.endSec)}
                          onBlur={(e) =>
                            applyCueTimeInput(cue.id, "endSec", e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.currentTarget.blur();
                            }
                          }}
                          placeholder="0:05"
                          dir="ltr"
                          className="w-[5rem] rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs font-mono text-white focus:border-[#22f0ff]/35 focus:outline-none"
                        />
                      </label>
                      <label className="flex min-w-[6rem] flex-1 flex-col gap-0.5 text-[10px] text-white/45">
                        {t.editStudio.dialogueSpeakerOptional}
                        <input
                          value={cue.speaker}
                          onChange={(e) =>
                            updateDialogueCue(cue.id, { speaker: e.target.value })
                          }
                          placeholder={t.editStudio.dialogueSpeakerOptional}
                          dir="auto"
                          className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-white placeholder:text-white/30 focus:border-[#22f0ff]/35 focus:outline-none"
                        />
                      </label>
                    </div>
                    <textarea
                      value={cue.text}
                      onChange={(e) => updateDialogueCue(cue.id, { text: e.target.value })}
                      placeholder={t.editStudio.dialoguePlaceholder}
                      rows={3}
                      dir="rtl"
                      className="w-full resize-y rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-sm leading-relaxed text-white placeholder:text-white/30 focus:border-[#22f0ff]/35 focus:outline-none"
                    />
                  </div>
                ))
              ) : (
                <p className="rounded-xl border border-dashed border-white/10 bg-[#0d1118] px-3 py-4 text-sm text-white/40">
                  {t.editStudio.dialogueLinesEmpty}
                </p>
              )}
            </div>

            <p className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-wide text-white/35">
              {t.editStudio.charactersOptionalLabel}
            </p>
            <div className="mb-4 rounded-xl border border-white/10 bg-[#0d1118] p-3">
              <p className="mb-2 text-[11px] text-white/40">{t.editStudio.charactersHint}</p>
              <div className="flex flex-wrap gap-2">
                <input
                  value={newCharacterName}
                  onChange={(e) => setNewCharacterName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCharacter();
                    }
                  }}
                  placeholder={t.editStudio.characterNamePlaceholder}
                  dir="auto"
                  className="min-w-[9rem] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#22f0ff]/35 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={addCharacter}
                  disabled={!newCharacterName.trim()}
                  className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t.editStudio.addCharacter}
                </button>
              </div>
              {activeCharacters.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeCharacters.map((character) => {
                    const selected = selectedCharacter?.id === character.id;
                    return (
                      <div key={character.id} className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => selectCharacter(character.id)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                            selected
                              ? "bg-[#22f0ff]/20 text-[#22f0ff] ring-1 ring-[#22f0ff]/40"
                              : "bg-white/8 text-white/70 ring-1 ring-white/10"
                          }`}
                        >
                          {character.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeCharacter(character.id)}
                          className="rounded-full p-1 text-white/40 hover:text-rose-300"
                          aria-label={t.editStudio.deleteCharacter}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {activeCharacters.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={
                  extractingDialogue ||
                  extractingAll ||
                  !selectedCharacter
                }
                onClick={() => void extractActiveDialogue()}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#22f0ff]/15 px-3 py-1.5 text-xs font-semibold text-[#22f0ff] ring-1 ring-[#22f0ff]/35 disabled:opacity-40"
              >
                {extractingDialogue ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Mic className="h-3.5 w-3.5" />
                )}
                {extractingDialogue
                  ? t.editStudio.extractingDialogue
                  : selectedCharacter
                    ? t.editStudio.extractCharacterDialogue.replace(
                        "{name}",
                        selectedCharacter.name,
                      )
                    : t.editStudio.extractCharacterDialoguePick}
              </button>
              {activeCharacters.length > 1 ? (
                <button
                  type="button"
                  disabled={extractingDialogue || extractingAll}
                  onClick={() => void extractAllCharacters()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#7c5cff]/20 px-3 py-1.5 text-xs font-semibold text-[#d4c4ff] ring-1 ring-[#7c5cff]/35 disabled:opacity-40"
                >
                  {extractingAll ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Mic className="h-3.5 w-3.5" />
                  )}
                  {extractingAll
                    ? t.editStudio.extractingDialogue
                    : t.editStudio.extractAllCharacters}
                </button>
              ) : null}
            </div>
            ) : null}
            {extractNote ? (
              <p
                className={`mt-2 text-xs ${
                  extractNote === t.editStudio.extractFailed ||
                  extractNote === t.editStudio.noAudioTrack ||
                  extractNote === t.editStudio.noDialogueInClip ||
                  extractNote === t.editStudio.selectCharacterFirst ||
                  extractNote === t.editStudio.noDialogueForCharacter ||
                  extractNote === t.editStudio.characterExists
                    ? "text-rose-300/90"
                    : "text-emerald-300/90"
                }`}
              >
                {extractNote}
              </p>
            ) : null}

            <div className="mt-4 space-y-3">
              <p className="text-[10px] text-white/40">{t.editStudio.pressHoldHint}</p>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold text-white/50">
                  {t.editStudio.subtitlePosition}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["bottom", t.editStudio.subtitlePositionBottom],
                      ["top", t.editStudio.subtitlePositionTop],
                      ["center", t.editStudio.subtitlePositionCenter],
                    ] as const
                  ).map(([id, label]) => (
                    <PressHoldChip
                      key={id}
                      label={label}
                      committed={(activeClip.subtitlePosition ?? "bottom") === id}
                      previewing={previewSubtitle?.subtitlePosition === id}
                      onHoldStart={() =>
                        setPreviewSubtitle({ subtitlePosition: id as SubtitlePosition })
                      }
                      onHoldEnd={() => setPreviewSubtitle(null)}
                      onCommit={() =>
                        persistClip(activeClip.id, {
                          subtitlePosition: id as SubtitlePosition,
                        })
                      }
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold text-white/50">
                  {t.editStudio.subtitleSize}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["small", t.editStudio.subtitleSizeSmall],
                      ["medium", t.editStudio.subtitleSizeMedium],
                      ["large", t.editStudio.subtitleSizeLarge],
                    ] as const
                  ).map(([id, label]) => (
                    <PressHoldChip
                      key={id}
                      label={label}
                      committed={(activeClip.subtitleSize ?? "medium") === id}
                      previewing={previewSubtitle?.subtitleSize === id}
                      onHoldStart={() =>
                        setPreviewSubtitle({ subtitleSize: id as SubtitleSize })
                      }
                      onHoldEnd={() => setPreviewSubtitle(null)}
                      onCommit={() =>
                        persistClip(activeClip.id, {
                          subtitleSize: id as SubtitleSize,
                        })
                      }
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold text-white/50">
                  {t.editStudio.subtitleBackground}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["transparent", t.editStudio.subtitleBgTransparent],
                      ["box", t.editStudio.subtitleBgBox],
                      ["shadow", t.editStudio.subtitleBgShadow],
                    ] as const
                  ).map(([id, label]) => (
                    <PressHoldChip
                      key={id}
                      label={label}
                      committed={(activeClip.subtitleBackground ?? "box") === id}
                      previewing={previewSubtitle?.subtitleBackground === id}
                      onHoldStart={() =>
                        setPreviewSubtitle({
                          subtitleBackground: id as SubtitleBackground,
                        })
                      }
                      onHoldEnd={() => setPreviewSubtitle(null)}
                      onCommit={() =>
                        persistClip(activeClip.id, {
                          subtitleBackground: id as SubtitleBackground,
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="rounded-2xl border border-white/10 bg-[#141821] p-3">
          <p className="text-xs font-semibold text-white/55">{t.editStudio.exportQuality}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={exporting}
              onClick={() => {
                setExportQuality("standard");
                storeExportQuality("standard");
              }}
              className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                exportQuality === "standard"
                  ? "bg-white text-black"
                  : "border border-white/15 text-white/70 hover:text-white"
              }`}
            >
              {t.editStudio.exportQualityStandard}
            </button>
            <button
              type="button"
              disabled={exporting}
              onClick={() => {
                setExportQuality("high");
                storeExportQuality("high");
              }}
              className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                exportQuality === "high"
                  ? "bg-[linear-gradient(135deg,#22f0ff,#7c5cff)] text-[#0b0d12]"
                  : "border border-white/15 text-white/70 hover:text-white"
              }`}
            >
              {t.editStudio.exportQualityHigh}
            </button>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-white/35">
            {exportQuality === "high"
              ? t.editStudio.exportQualityHighHint
              : t.editStudio.exportQualityStandardHint}
          </p>
        </div>
        <button
          type="button"
          disabled={exporting || timeline.clips.length === 0}
          onClick={() => void handleMergeExport()}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#22f0ff,#7c5cff)] px-5 py-3.5 text-sm font-bold text-[#0b0d12] disabled:opacity-45"
        >
          {exporting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Clapperboard className="h-5 w-5" />
          )}
          {exporting
            ? t.editStudio.exporting
            : timeline.clips.length > 1
              ? t.editStudio.mergeExport
              : t.editStudio.export}
        </button>
        {timeline.clips.length > 1 && activeClip ? (
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleExportActive()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white/80 disabled:opacity-45"
          >
            <Download className="h-4 w-4" />
            {t.editStudio.exportActiveClip}
          </button>
        ) : null}
        <button
          type="button"
          onClick={clearAll}
          className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-semibold text-white/55"
        >
          {t.editStudio.clearAll}
        </button>
      </div>

      <p className="text-center text-[10px] text-white/30">{t.editStudio.clientNote}</p>

      {exportNote ? (
        <p className="text-center text-sm text-emerald-300/90">{exportNote}</p>
      ) : null}
      {exportDownloadUrl ? (
        <div className="flex flex-col items-center gap-2">
          <div className="flex flex-wrap justify-center gap-2">
            <a
              href={exportDownloadUrl}
              download={exportDownloadName || "vyronix-export.mp4"}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-bold text-emerald-200 ring-1 ring-emerald-400/30"
            >
              <Download className="h-4 w-4" aria-hidden />
              {dir === "rtl" ? "تحميل MP4" : "Download MP4"}
            </a>
            <button
              type="button"
              disabled={publishBusy || publishedToHome}
              onClick={() => void handlePublishToHome()}
              className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {publishBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Home className="h-4 w-4" aria-hidden />
              )}
              {publishedToHome ? t.editStudio.publishedToHome : t.editStudio.publishToHome}
            </button>
          </div>
          {publishedToHome ? (
            <Link
              href="/"
              className="text-xs font-semibold text-[#22f0ff]/90 underline-offset-2 hover:underline"
            >
              {t.editStudio.viewOnHome}
            </Link>
          ) : null}
          {publishNote ? (
            <p className="text-center text-xs text-emerald-300/90">{publishNote}</p>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p className="text-center text-sm text-rose-300/90">{error}</p>
      ) : null}
    </div>
  );
}
