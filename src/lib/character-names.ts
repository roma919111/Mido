import type { VisualReference } from "@/lib/types";

/** Default upload labels that are not real character names. */
const GENERIC_LABEL =
  /^(upload|reference|edit-|edit-start|edit-image|character|شخصية|من المشهد|من الصورة|\d+$)/i;

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

/** First index where a character name appears in the prompt (−1 if absent). */
function nameMentionIndex(prompt: string, name: string): number {
  const pattern = new RegExp(
    `(?:^|[^\\p{L}\\p{N}_]|و)${escapeRegExp(name)}(?=[^\\p{L}\\p{N}_]|$)`,
    "iu",
  );
  const m = pattern.exec(prompt || "");
  return m ? m.index : -1;
}

/**
 * Stable order for BytePlus @ImageN tags:
 * named characters in prompt-mention order, then remaining refs.
 * Reduces A↔B identity swaps.
 */
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

/**
 * Refs to send for generation:
 * Always keep every uploaded character still — names only drive identity hints.
 * Ordered for stable @Image binding.
 */
export function resolveCharacterRefsForPrompt(
  prompt: string,
  refs: VisualReference[],
): { refs: VisualReference[]; matched: VisualReference[] } {
  const matched = matchNamedCharacters(prompt, refs);
  const ordered = orderCharacterRefsForBinding(prompt, refs);
  return { refs: ordered, matched };
}

/** Soft identity hint appended for the model when names are linked. */
export function appendCharacterLinkHint(
  prompt: string,
  matched: VisualReference[],
  allRefs: VisualReference[] = matched,
): string {
  const refs = (allRefs.length ? allRefs : matched).slice(0, 4);
  if (!refs.length) return prompt;
  if (
    prompt.includes("IDENTITY LOCK") ||
    prompt.includes("Use these character references")
  ) {
    return prompt;
  }

  const lines = refs.map((r, i) => {
    const tag = `@Image${i + 1}`;
    const name = isCharacterName(r.label)
      ? normalizeCharacterName(r.label)
      : "";
    return name
      ? `- ${tag} = ONLY "${name}" (face + hair + skin from ${tag} only; never swap with another @Image)`
      : `- ${tag} = character ${i + 1} (face + hair + skin from ${tag} only; never swap)`;
  });

  const antiSwap =
    refs.length > 1
      ? `\nIDENTITY LOCK: Do not swap faces/bodies between ${refs
          .map((_, i) => `@Image${i + 1}`)
          .join(" and ")}. Do not mirror identities.`
      : `\nIDENTITY LOCK: Keep @Image1 face/identity consistent; do not replace with a different person.`;

  const hint = `\n\nUse these character references:\n${lines.join("\n")}${antiSwap}\nKeep a photoreal live-action look (not CGI).`;
  return `${prompt.trim()}${hint}`;
}

/**
 * Behind-the-scenes wardrobe policy for BytePlus only (not shown as user text).
 * Keeps scene-appropriate clothing while avoiding revealing outfits that trip filters.
 */
export function withModestWardrobeDirective(prompt: string): string {
  const base = (prompt || "").trim();
  if (!base) return base;
  if (base.includes("WARDROBE POLICY")) return base;

  const scene = base.toLowerCase();
  let attire =
    "casual modest everyday clothes that fit the scene (shirt/blouse + pants or dress covering torso)";

  if (
    /شاطئ|بحر|مسبح|beach|pool|swim|ocean|ساحل|غوص/.test(scene)
  ) {
    attire =
      "modest beachwear / swim cover-up suitable for a family beach scene (no bikini, no lingerie)";
  } else if (/رياض|جيم|gym|sport|جري|يوغا|workout/.test(scene)) {
    attire = "modest athletic wear (full top + leggings or shorts; no lingerie)";
  } else if (/حفل|سهرة|party|wedding|زفاف|مناسبة/.test(scene)) {
    attire = "elegant modest formal attire suited to the event (no revealing cuts)";
  } else if (/مكتب|عمل|office|meeting|عمل/.test(scene)) {
    attire = "smart casual / business-appropriate modest clothing";
  } else if (/شتاء|ثلج|برد|winter|snow/.test(scene)) {
    attire = "warm modest winter clothing (coat/sweater)";
  } else if (/نوم|سرير|bedroom|sleep|ليل/.test(scene)) {
    attire = "modest comfortable home clothes / pajamas (fully covered)";
  }

  return [
    base,
    "",
    "WARDROBE POLICY (internal, must follow):",
    `- Dress every character in ${attire}.`,
    "- Match face, hair, skin tone, body shape from the @Image references.",
    "- Do NOT copy revealing outfits from reference photos (no bikini, lingerie, nudity, or sheer clothing).",
    "- Clothing must look natural for the scene while remaining non-revealing.",
  ].join("\n");
}
