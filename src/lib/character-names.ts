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

/** Lightweight Arabic → Latin aliases for matching English prompts only. */
const ARABIC_NAME_ALIASES: Record<string, string[]> = {
  محمد: ["mohammed", "mohamed", "muhammad", "mohammad"],
  أحمد: ["ahmed", "ahmad"],
  محمود: ["mahmoud", "mahmud"],
  علي: ["ali"],
  حسن: ["hassan", "hasan"],
  حسين: ["hussein", "hussain", "hosein"],
  خالد: ["khaled", "khalid"],
  عمر: ["omar", "umar"],
  يوسف: ["youssef", "yousef", "yusuf", "joseph"],
  إبراهيم: ["ibrahim", "ebrahem"],
  سارة: ["sara", "sarah"],
  فاطمة: ["fatima", "fatema"],
  نورة: ["noura", "nora", "norah"],
  مريم: ["mariam", "maryam", "mary"],
  ليلى: ["layla", "leila", "laila"],
  نور: ["noor", "nour", "nur"],
  ريان: ["rayan", "ryan"],
  ليان: ["layan"],
  جود: ["joud", "jud"],
};

function nameAliases(name: string): string[] {
  const n = normalizeCharacterName(name);
  if (!n) return [];
  const lower = n.toLowerCase();
  const out = new Set<string>([n, lower]);
  const mapped = ARABIC_NAME_ALIASES[n];
  if (mapped) for (const a of mapped) out.add(a);
  // Also reverse: English label → keep as-is for Arabic prompts
  for (const [ar, aliases] of Object.entries(ARABIC_NAME_ALIASES)) {
    if (aliases.some((a) => a === lower)) {
      out.add(ar);
      for (const a of aliases) out.add(a);
    }
  }
  return [...out];
}

function nameMentionIndex(prompt: string, name: string): number {
  const aliases = nameAliases(name);
  let best = -1;
  for (const alias of aliases) {
    const pattern = new RegExp(
      `(?:^|[^\\p{L}\\p{N}_]|و)${escapeRegExp(alias)}(?=[^\\p{L}\\p{N}_]|$)`,
      "iu",
    );
    const m = pattern.exec(prompt || "");
    if (m && (best < 0 || m.index < best)) best = m.index;
  }
  return best;
}

/** Names mentioned in the customer prompt (Arabic + English aliases). */
export function extractPromptCharacterNames(prompt: string): string[] {
  const text = (prompt || "").trim();
  if (!text) return [];
  const found = new Map<string, number>();

  for (const ar of Object.keys(ARABIC_NAME_ALIASES)) {
    const at = nameMentionIndex(text, ar);
    if (at >= 0) found.set(ar, at);
  }

  const namedEn =
    /\bnamed\s+([A-Za-z\u0600-\u06FF][A-Za-z\u0600-\u06FF\s'-]{0,22})/gi;
  let m: RegExpExecArray | null;
  while ((m = namedEn.exec(text))) {
    const raw = normalizeCharacterName(m[1] || "");
    if (raw.length >= 2) found.set(raw, m.index);
  }

  const capWord =
    /\b([A-Z][a-z\u0600-\u06FF]{2,20})\b/g;
  while ((m = capWord.exec(text))) {
    const raw = m[1] || "";
    const lower = raw.toLowerCase();
    for (const [ar, aliases] of Object.entries(ARABIC_NAME_ALIASES)) {
      if (aliases.includes(lower) || ar === raw) {
        found.set(raw, m.index);
        break;
      }
    }
  }

  return [...found.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([name]) => name)
    .slice(0, 6);
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
    if (nameMentionIndex(text, item.name) >= 0) {
      matched.push(item.ref);
      used.add(item.ref.id);
    }
  }
  return matched;
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
  // Always keep every uploaded still — ByteDance needs the images attached.
  return { refs: orderCharacterRefsForBinding(prompt, refs), matched };
}

/**
 * Strip server/client internal notes so Assets / Edit show the user's words only.
 */
export function stripInternalPromptNotes(prompt: string): string {
  if (!prompt) return "";
  let text = prompt;
  text = text.replace(/\n+Use these character references:[\s\S]*$/i, "");
  text = text.replace(/\nWARDROBE POLICY[\s\S]*$/i, "");
  text = text.replace(/\nIDENTITY LOCK:[\s\S]*$/i, "");
  text = text.replace(/\n\n@Image\d+ is[\s\S]*$/i, "");
  text = text.replace(/^(?:@Image\d+[^\n]*\n)+/gim, "");
  text = text.replace(
    /\n*If any reference shows bikini[\s\S]*?change clothing only\./gi,
    "",
  );
  text = text.replace(/\n*Dress characters in modest[^\n]*/gi, "");
  text = text.replace(/\n*Modest clothes that fit[^\n]*/gi, "");
  text = text.replace(/\n*Keep faces matching[^\n]*/gi, "");
  text = text.replace(/\n*The person in the first frame is[^\n]*/gi, "");
  text = text.replace(/\n*Keep the same face as the first frame[^\n]*/gi, "");
  text = text.replace(/\n*Match faces from @Image[^\n]*/gi, "");
  text = text.replace(/\n*Appearances locked to @Image[^\n]*/gi, "");
  text = text.replace(/\n\n\(الشخصي[^\n]*المرفقة تمامًا\.\)/g, "");
  text = text.replace(/\n\n\(جارٍ توليد ودمج[\s\S]*$/u, "");
  text = text.replace(/\n\n\(جاري توليد ودمج[\s\S]*$/u, "");
  // Drop leftover "- @ImageN = ONLY …" bullets from older client builds.
  text = text.replace(/\n-\s*@Image\d+\s*=\s*ONLY[^\n]*/gi, "");
  return text.trim();
}

const MODEST_WARDROBE =
  "If any reference shows bikini, swimsuit, lingerie, underwear, or nudity, dress that person in modest casual clothes that fit the scene (full top + pants or dress). Keep the same face, hair, and skin — change clothing only.";

/**
 * ByteDance Seedance API prompt (never stored on asset).
 * Always tags every uploaded still as @ImageN — required for identity.
 * Keeps the user's Arabic/English name as-is; also swaps EN aliases in-scene.
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
    const aliases = nameAliases(name).sort((a, b) => b.length - a.length);
    for (const alias of aliases) {
      const pattern = new RegExp(
        `(^|[^\\p{L}\\p{N}_]|و)(${escapeRegExp(alias)})(?=[^\\p{L}\\p{N}_]|$)`,
        "giu",
      );
      if (!pattern.test(scene)) continue;
      // Reset lastIndex after test()
      pattern.lastIndex = 0;
      scene = scene.replace(pattern, `$1${tag}`);
      break;
    }
  }

  // ByteDance rule: every reference_image must be cited with @ImageN.
  const intro = ordered
    .map((r, i) => {
      const tag = `@Image${i + 1}`;
      const name = isCharacterName(r.label)
        ? normalizeCharacterName(r.label)
        : "";
      return name
        ? `${tag} is "${name}" — use only this face for ${name}.`
        : `${tag} is character ${i + 1} — keep this face.`;
    })
    .join(" ");

  const tags = ordered.map((_, i) => `@Image${i + 1}`).join(", ");
  // Ensure the scene itself cites every @ImageN (required by Seedance multimodal).
  const missingTags = ordered
    .map((_, i) => `@Image${i + 1}`)
    .filter((tag) => !scene.includes(tag));
  if (missingTags.length) {
    scene = `${missingTags.join(" and ")} appear in this scene. ${scene}`;
  }

  return [
    intro,
    scene,
    `Appearances locked to ${tags}; do not blend faces between them.`,
    MODEST_WARDROBE,
  ].join("\n");
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
  if (!base || /modest casual clothes/i.test(base)) return base;
  return `${base}\n${MODEST_WARDROBE}`;
}
