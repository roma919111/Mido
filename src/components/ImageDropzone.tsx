"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import type { VisualReference } from "@/lib/types";

interface ImageDropzoneProps {
  label: string;
  hint: string;
  value: VisualReference | null;
  previewUrl?: string | null;
  uploading?: boolean;
  onUpload: (file: File) => Promise<void>;
  onClear: () => void;
}

export function ImageDropzone({
  label,
  hint,
  value,
  previewUrl,
  uploading = false,
  onUpload,
  onClear,
}: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      await onUpload(file);
    },
    [onUpload],
  );

  const preview = previewUrl ?? value?.url;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-white/80">{label}</p>
        {value && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 text-xs text-white/45 transition hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={`relative flex min-h-[140px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed px-4 py-6 text-center transition duration-300 ${
          dragOver
            ? "border-[var(--accent)] bg-[rgba(46,230,166,0.08)]"
            : "border-white/15 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]"
        }`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={label}
            className="absolute inset-0 h-full w-full object-cover opacity-80"
          />
        ) : null}

        <div className={`relative z-10 flex flex-col items-center gap-2 ${preview ? "rounded-xl bg-black/55 px-4 py-3 backdrop-blur-sm" : ""}`}>
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
          ) : (
            <ImagePlus className="h-5 w-5 text-[var(--accent)]" />
          )}
          <p className="text-sm text-white/85">
            {uploading ? "Uploading…" : preview ? "Replace image" : "Drop image or browse"}
          </p>
          <p className="text-xs text-white/45">{hint}</p>
        </div>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}
