"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import type { VisualReference } from "@/lib/types";

interface Props {
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
  uploading,
  onUpload,
  onClear,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const preview = previewUrl ?? value?.url;

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      await onUpload(file);
    },
    [onUpload],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white/80">{label}</p>
        {value && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-white"
          >
            <X className="h-3.5 w-3.5" /> Clear
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
        className={`relative flex min-h-[132px] w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed px-4 py-5 transition ${
          dragOver
            ? "border-cyan-300 bg-cyan-400/10"
            : "border-white/15 bg-black/20 hover:border-cyan-300/40"
        }`}
      >
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={label} className="absolute inset-0 h-full w-full object-cover opacity-75" />
        )}
        <div
          className={`relative z-10 flex flex-col items-center gap-2 ${
            preview ? "rounded-xl bg-black/55 px-4 py-3 backdrop-blur" : ""
          }`}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
          ) : (
            <ImagePlus className="h-5 w-5 text-cyan-300" />
          )}
          <p className="text-sm text-white/85">
            {uploading ? "Uploading…" : preview ? "Replace image" : "Drop or browse"}
          </p>
          <p className="text-xs text-white/40">{hint}</p>
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
