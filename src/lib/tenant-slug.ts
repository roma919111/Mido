const ARABIC_MAP: Record<string, string> = {
  ا: "a",
  أ: "a",
  إ: "i",
  آ: "a",
  ب: "b",
  ت: "t",
  ث: "th",
  ج: "j",
  ح: "h",
  خ: "kh",
  د: "d",
  ذ: "dh",
  ر: "r",
  ز: "z",
  س: "s",
  ش: "sh",
  ص: "s",
  ض: "d",
  ط: "t",
  ظ: "z",
  ع: "a",
  غ: "gh",
  ف: "f",
  ق: "q",
  ك: "k",
  ل: "l",
  م: "m",
  ن: "n",
  ه: "h",
  و: "w",
  ي: "y",
  ة: "h",
  ى: "a",
  ء: "",
  " ": "-",
};

/** Build `{name}.vyronix.app` subdomain slug from registry name. */
export function slugFromRegistryName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "tenant";

  let out = "";
  for (const ch of trimmed.toLowerCase()) {
    if (/[a-z0-9]/.test(ch)) {
      out += ch;
      continue;
    }
    if (ch === "-" || ch === "_") {
      out += "-";
      continue;
    }
    const mapped = ARABIC_MAP[ch];
    if (mapped !== undefined) {
      out += mapped;
    }
  }

  out = out
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return out.slice(0, 48) || "tenant";
}

export function tenantHostFromSlug(slug: string): string {
  return `${slug}.vyronix.app`;
}
