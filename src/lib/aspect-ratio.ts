/** Parse "W:H" into a numeric width/height ratio. */
export function aspectRatioValue(label: string): number {
  const [w, h] = label.split(":").map(Number);
  if (!w || !h || !Number.isFinite(w) || !Number.isFinite(h)) return 1;
  return w / h;
}

/**
 * Pick the closest supported aspect label for pixel dimensions.
 * Uses log-distance so 9:16 vs 3:4 vs 1:1 stay well separated.
 */
export function nearestAspectRatio(
  width: number,
  height: number,
  options: readonly string[],
): string {
  if (!options.length || !(width > 0) || !(height > 0)) {
    return options[0] || "16:9";
  }
  const target = width / height;
  let best = options[0]!;
  let bestDiff = Infinity;
  for (const opt of options) {
    const ratio = aspectRatioValue(opt);
    const diff = Math.abs(Math.log(ratio / target));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = opt;
    }
  }
  return best;
}

/** Read natural pixel size from a File or object/data URL. */
export function readImageDimensions(
  source: File | string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url =
      typeof source === "string" ? source : URL.createObjectURL(source);
    const revoke = typeof source !== "string";
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      if (revoke) URL.revokeObjectURL(url);
      if (!(width > 0) || !(height > 0)) {
        reject(new Error("Invalid image dimensions"));
        return;
      }
      resolve({ width, height });
    };
    img.onerror = () => {
      if (revoke) URL.revokeObjectURL(url);
      reject(new Error("Failed to read image"));
    };
    img.src = url;
  });
}
