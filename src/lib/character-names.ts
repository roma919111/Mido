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
    // Allow an optional Arabic و glued to the name (ومحمد).
    const pattern = new RegExp(
      `(?:^|[^\\p{L}\\p{N}_]|و)${escapeRegExp(item.name)}(?=[^\\p{L}\\p{N}_]|$)`,
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
 * Always keep every uploaded character still — names only drive identity hints.
 * (Dropping unmentioned named refs was stripping identity from the model.)
 */
export function resolveCharacterRefsForPrompt(
  prompt: string,
  refs: VisualReference[],
): { refs: VisualReference[]; matched: VisualReference[] } {
  const matched = matchNamedCharacters(prompt, refs);
  return { refs, matched };
}

/** Soft identity hint appended for the model when names are linked. */
export function appendCharacterLinkHint(
  prompt: string,
  matched: VisualReference[],
  allRefs: VisualReference[] = matched,
): string {
  const refs = allRefs.length ? allRefs : matched;
  if (!refs.length) return prompt;
  if (prompt.includes("@Image1") || prompt.includes("Use these character references")) {
    return prompt;
  }

  const lines = refs.map((r, i) => {
    const tag = `@Image${i + 1}`;
    const name = isCharacterName(r.label)
      ? normalizeCharacterName(r.label)
      : "";
    return name
      ? `- ${tag} is "${name}" — match this person's face, hair, skin, and wardrobe exactly`
      : `- ${tag} — match this reference appearance exactly`;
  });
  const hint = `\n\nUse these character references:\n${lines.join("\n")}\nKeep a photoreal live-action look (not CGI). Keep identity consistent across the shot.`;
  return `${prompt.trim()}${hint}`;
}
