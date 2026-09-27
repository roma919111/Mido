/**
 * Lightweight sensitive wording for LTX HF Space (no Claude call).
 * Mirrors production director swap rules — keep in sync with bundle module 888587.
 */

const AR_RULES: [RegExp, string][] = [
  [/القضيب/giu, "مكان حساس"],
  [/قضيب/giu, "مكان حساس"],
  [/العضو\s*الذكري/giu, "مكان حساس"],
  [/المؤخرة/giu, "عضلات الجلوتس"],
  [/مؤخرة/giu, "عضلات الجلوتس"],
  [/طيز/giu, "عضلات الجلوتس"],
  [/ال?\s*فرج/giu, "مكان حساس"],
  [/فرج/giu, "مكان حساس"],
];

const EN_RULES: [RegExp, string][] = [
  [/\b(penis|dick|cock|pussy|vagina|vulva|boobs?|tits?)\b/gi, "sensitive area"],
  [/\b(buttocks?|booty|glutes?|ass)\b/gi, "glute muscles"],
  [/\b(nude|naked|nsfw)\b/gi, "clothed scene"],
];

export function applyDirectorSensitiveReplacements(text: string): string {
  let out = String(text || "").replace(/\r\n/g, "\n");
  for (const [re, rep] of AR_RULES) out = out.replace(re, rep);
  for (const [re, rep] of EN_RULES) out = out.replace(re, rep);
  return out
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
