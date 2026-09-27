/** Client-safe language checks for the H3 / rental prompt box (no server imports). */

export function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

/** Literal translation result is usable: no Arabic left and at least a few Latin letters. */
export function isAcceptableLiteralEnglish(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || hasArabic(trimmed)) return false;
  return (trimmed.match(/[A-Za-z]/g) || []).length >= 4;
}
