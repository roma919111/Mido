import type { VisualReference } from "@/lib/types";

/** Default upload labels that are not real character names. */
const GENERIC_LABEL =
  /^(upload|reference|edit-|edit-start|edit-image|character|شخصية|من المشهد|من الصورة|\d+$)/i;

export function isCharacterName(label: string | null | undefined): boolean {
  const name = (label || "").trim();
  if (name.length < 2) return false;
  if (GENERIC_LABEL.test(name)) return false;
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

function nameMentionIndex(prompt: string, name: string): number {
  const pattern = new RegExp(
    `(?:^|[^\\p{L}\\p{N}_]|و)${escapeRegExp(name)}(?=[^\\p{L}\\p{N}_]|$)`,
    "iu",
  );
  const m = pattern.exec(prompt || "");
  return m ? m.index : -1;
}

/** Named chars first (prompt order), then other refs — stable @ImageN order. */
export function orderCharacterRefsForBinding(
  prompt: string,
  refs: VisualReference[],
): VisualReference[] {
  if (!refs.length) return [];
  const matched = matchNamedCharacters(prompt, refs);
  const matchedIds = new Set(matched.map((r) => r.id));
  const namedOrdered = [...matched].sort((a, b) => {
    const na = normalizeCharacterName(a.label);
    const nb = normalizeCharacterName(b.label);
    const ia = nameMentionIndex(prompt, na);
    const ib = nameMentionIndex(prompt, nb);
    if (ia !== ib) return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib);
    return na.localeCompare(nb, "ar");
  });
  const rest = refs.filter((r) => !matchedIds.has(r.id));
  return [...namedOrdered, ...rest].slice(0, 4);
}

export function resolveCharacterRefsForPrompt(
  prompt: string,
  refs: VisualReference[],
): { refs: VisualReference[]; matched: VisualReference[] } {
  const matched = matchNamedCharacters(prompt, refs);
  return { refs: orderCharacterRefsForBinding(prompt, refs), matched };
}

/**
 * Strip server/client internal notes so Assets / Edit show the user's words only.
 */
export function stripInternalPromptNotes(prompt: string): string {
  if (!prompt) return "";
  let text = prompt;
  text = text.replace(/\n\nUse these character references:[\s\S]*$/i, "");
  text = text.replace(/\nWARDROBE POLICY[\s\S]*$/i, "");
  text = text.replace(/\nIDENTITY LOCK:[\s\S]*$/i, "");
  text = text.replace(/\n\n@Image\d+ is[\s\S]*$/i, "");
  // Leading Seedance binding lines we may prepend server-side
  text = text.replace(/^(?:@Image\d+[^\n]*\n)+/gim, "");
  text = text.replace(/\n*Dress characters in modest[^\n]*/gi, "");
  text = text.replace(/\n*Match faces from @Image[^\n]*/gi, "");
  text = text.replace(/\n\n\(الشخصي[^\n]*المرفقة تمامًا\.\)/g, "");
  text = text.replace(/\n\n\(جارٍ توليد ودمج[\s\S]*$/u, "");
  text = text.replace(/\n\n\(جاري توليد ودمج[\s\S]*$/u, "");
  return text.trim();
}

const MODEST_WARDROBE =
  "If any reference shows bikini, swimsuit, lingerie, underwear, or nudity, dress that person in modest casual clothes that fit the scene (full top + pants or dress). Keep the same face, hair, and skin — change clothing only.";

/**
 * Seedance API prompt only (never store on asset).
 * Replaces each character name in the scene with `@ImageN (Name)`.
 */
export function buildSeedanceCharacterPrompt(
  userPrompt: string,
  refs: VisualReference[],
): string {
  const clean = stripInternalPromptNotes(userPrompt);
  const ordered = orderCharacterRefsForBinding(clean, refs);
  if (!ordered.length) return clean;

  let scene = clean;
  const named = ordered
    .map((r, i) => ({
      i,
      name: isCharacterName(r.label) ? normalizeCharacterName(r.label) : "",
    }))
    .filter((x) => x.name.length >= 2)
    .sort((a, b) => b.name.length - a.name.length);

  for (const { i, name } of named) {
    const tag = `@Image${i + 1}`;
    if (scene.includes(tag)) continue;
    const pattern = new RegExp(
      `(^|[^\\p{L}\\p{N}_]|و)(${escapeRegExp(name)})(?=[^\\p{L}\\p{N}_]|$)`,
      "giu",
    );
    scene = scene.replace(pattern, `$1${tag} ($2)`);
  }

  const intro = ordered
    .map((r, i) => {
      const tag = `@Image${i + 1}`;
      const name = isCharacterName(r.label)
        ? normalizeCharacterName(r.label)
        : "";
      return name
        ? `${tag} is "${name}" — use this face only for ${name}.`
        : `${tag} is character ${i + 1} — keep this face.`;
    })
    .join(" ");

  const tags = ordered.map((_, i) => `@Image${i + 1}`).join(", ");
  return [intro, scene, `Keep faces matching ${tags}.`, MODEST_WARDROBE].join(
    "\n",
  );
}

/** Single-character path (first_frame) — strongest identity lock on Seedance mini. */
export function buildFirstFrameCharacterPrompt(
  userPrompt: string,
  ref: VisualReference | undefined,
): string {
  const clean = stripInternalPromptNotes(userPrompt);
  const name =
    ref && isCharacterName(ref.label)
      ? normalizeCharacterName(ref.label)
      : "";
  if (name) {
    return [
      clean,
      `The person in the first frame is "${name}" — keep the same face, hair, and skin throughout.`,
      MODEST_WARDROBE,
    ].join("\n");
  }
  return [
    clean,
    "Keep the same face as the first frame throughout.",
    MODEST_WARDROBE,
  ].join("\n");
}

/** @deprecated */
export function appendCharacterLinkHint(
  prompt: string,
  _matched: VisualReference[],
  allRefs: VisualReference[] = [],
): string {
  return buildSeedanceCharacterPrompt(prompt, allRefs);
}

/** @deprecated */
export function withModestWardrobeDirective(prompt: string): string {
  const base = stripInternalPromptNotes(prompt);
  if (!base || /modest clothes that fit/i.test(base)) return base;
  return `${base}\nModest clothes that fit the scene.`;
}
