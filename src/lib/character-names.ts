import type { VisualReference } from "@/lib/types";

/** Default upload labels that are not real character names. */
const GENERIC_LABEL =
  /^(upload|reference|edit-|edit-start|edit-image|character|شخصية|\d+$)/i;

export function isCharacterName(label: string | null | undefined): boolean {
  const name = (label || "").trim();
  if (name.length < 2) return false;
  if (GENERIC_LABEL.test(name)) return false;
  // Filenames like photo.jpg / IMG_001
  if (/\.(png|jpe?g|webp|gif|heic)$/i.test(name)) return false;
  if (/^IMG[_-]?\d+/i.test(name)) return false;
  return true;
}

export function normalizeCharacterName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, 40);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Find named character refs mentioned in the prompt (no @ required).
 * Longer names win first to avoid short-name collisions.
 */
export function matchNamedCharacters(
  prompt: string,
  refs: VisualReference[],
): VisualReference[] {
  const text = prompt || "";
  if (!text.trim() || !refs.length) return [];

  const named = refs
    .filter((r) => isCharacterName(r.label))
    .map((r) => ({ ref: r, name: normalizeCharacterName(r.label) }))
    .filter((x) => x.name.length >= 2)
    .sort((a, b) => b.name.length - a.name.length);

  const matched: VisualReference[] = [];
  const used = new Set<string>();

  for (const item of named) {
    if (used.has(item.ref.id)) continue;
    const pattern = new RegExp(
      `(^|[^\\p{L}\\p{N}_])${escapeRegExp(item.name)}(?=[^\\p{L}\\p{N}_]|$)`,
      "iu",
    );
    if (pattern.test(text)) {
      matched.push(item.ref);
      used.add(item.ref.id);
    }
  }
  return matched;
}

/**
 * Refs to send for generation:
 * - If the prompt mentions named characters → those + any unnamed refs
 * - Otherwise → all refs (current behavior)
 */
export function resolveCharacterRefsForPrompt(
  prompt: string,
  refs: VisualReference[],
): { refs: VisualReference[]; matched: VisualReference[] } {
  const matched = matchNamedCharacters(prompt, refs);
  if (!matched.length) {
    return { refs, matched: [] };
  }
  const matchedIds = new Set(matched.map((r) => r.id));
  const unnamed = refs.filter((r) => !isCharacterName(r.label));
  const merged = [...matched];
  for (const r of unnamed) {
    if (!matchedIds.has(r.id)) merged.push(r);
  }
  return { refs: merged, matched };
}

/** Soft identity hint appended for the model when names are linked. */
export function appendCharacterLinkHint(
  prompt: string,
  matched: VisualReference[],
): string {
  if (!matched.length) return prompt;
  const names = matched
    .map((r) => normalizeCharacterName(r.label))
    .filter(Boolean);
  if (!names.length) return prompt;
  const list = names.map((n) => `"${n}"`).join("، ");
  const hint =
    names.length === 1
      ? `\n\n(الشخصية ${list} يجب أن تطابق صورة المرجع المرفقة تمامًا.)`
      : `\n\n(الشخصيات ${list} يجب أن تطابق صور المراجع المرفقة تمامًا.)`;
  if (prompt.includes("يجب أن تطابق صورة")) return prompt;
  return `${prompt.trim()}${hint}`;
}
