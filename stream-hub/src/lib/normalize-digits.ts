/** Accept Western (0-9) and Arabic-Indic (٠-٩) digits — common on Arabic keyboards. */
export function normalizeDigits(value: string, maxLen = 6): string {
  const arabicIndic = "٠١٢٣٤٥٦٧٨٩";
  const extendedArabic = "۰۱۲۳۴۵۶۷۸۹";

  let out = "";
  for (const ch of value) {
    const arIdx = arabicIndic.indexOf(ch);
    if (arIdx >= 0) {
      out += String(arIdx);
      continue;
    }
    const faIdx = extendedArabic.indexOf(ch);
    if (faIdx >= 0) {
      out += String(faIdx);
      continue;
    }
    if (ch >= "0" && ch <= "9") out += ch;
  }
  return out.slice(0, maxLen);
}
