/**
 * Translate BytePlus / Ark API errors into clear Arabic for the customer UI.
 * Prefer the real upstream reason (e.g. real-person privacy) over generic failure text.
 */

function collectRawText(value: unknown, depth = 0): string {
  if (depth > 6 || value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => collectRawText(item, depth + 1)).join(" ");
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map((item) => collectRawText(item, depth + 1))
      .join(" ");
  }
  return "";
}

function looksLikeRealPersonPrivacy(raw: string): boolean {
  const t = raw.toLowerCase();
  return (
    t.includes("privacyinformation") ||
    t.includes("privacy information") ||
    t.includes("may contain real person") ||
    t.includes("contain real person") ||
    t.includes("real person") ||
    t.includes("inputimagesensitivecontentdetected.privacy") ||
    (t.includes("sensitive") && t.includes("privacy") && t.includes("person"))
  );
}

function looksLikeOtherSensitive(raw: string): boolean {
  const t = raw.toLowerCase();
  return (
    t.includes("sensitivecontent") ||
    t.includes("sensitive content") ||
    t.includes("inputtextsensitive") ||
    t.includes("inputvideosensitive") ||
    t.includes("outputvideosensitive") ||
    t.includes("nsfw") ||
    t.includes("moderation")
  );
}

function looksLikeInvalidImage(raw: string): boolean {
  const t = raw.toLowerCase();
  return (
    t.includes("invalidparameter") ||
    t.includes("invalid image") ||
    t.includes("image url") ||
    t.includes("download") ||
    t.includes("width of the image") ||
    t.includes("height of the image") ||
    t.includes("aspect ratio") ||
    t.includes("image size") ||
    t.includes("unsupported")
  );
}

function looksLikeRateLimit(raw: string): boolean {
  const t = raw.toLowerCase();
  return t.includes("ratelimit") || t.includes("rate limit") || t.includes("too many request") || t.includes("429");
}

function looksLikeAuth(raw: string): boolean {
  const t = raw.toLowerCase();
  return (
    t.includes("unauthorized") ||
    t.includes("authentication") ||
    t.includes("invalid api") ||
    t.includes("api key") ||
    t.includes("permission") ||
    t.includes("forbidden")
  );
}

function looksLikeQuota(raw: string): boolean {
  const t = raw.toLowerCase();
  return t.includes("quota") || t.includes("insufficient") || t.includes("balance") || t.includes("billing");
}

/** Map a raw BytePlus/Ark error string (or object blob) to Arabic for the UI. */
export function translateBytePlusError(input: unknown, fallback = "فشل إنشاء الفيديو"): string {
  const raw = typeof input === "string" ? input : collectRawText(input);
  const text = raw.trim();
  if (!text) return fallback;

  // Already Arabic (or mostly Arabic) — keep as-is
  if (/[\u0600-\u06FF]/.test(text) && !/[A-Za-z]{8,}/.test(text)) {
    return text;
  }

  if (looksLikeRealPersonPrivacy(text)) {
    return "رفض BytePlus الصورة لأنها تبدو كشخص حقيقي (خصوصية الوجوه). استخدم صورة شخصية رقمية أو رندر 3D أو رسمة واضحة للوجه والجسد.";
  }

  if (looksLikeOtherSensitive(text)) {
    return "رفض BytePlus المحتوى لأنه مخالف لسياسة المحتوى الحساس. عدّل الوصف أو الصورة ثم أعد المحاولة.";
  }

  if (looksLikeInvalidImage(text)) {
    return "صورة المرجع غير مقبولة لدى BytePlus (الحجم أو الأبعاد أو الرابط). جرّب صورة أوضح أو مقاس مختلف.";
  }

  if (looksLikeRateLimit(text)) {
    return "تم تجاوز حد الطلبات لدى BytePlus مؤقتاً. انتظر قليلاً ثم أعد المحاولة.";
  }

  if (looksLikeAuth(text)) {
    return "مشكلة مصادقة أو صلاحيات مع BytePlus. راجع إعدادات المفتاح لدى المسؤول.";
  }

  if (looksLikeQuota(text)) {
    return "رصيد أو حصة BytePlus غير كافية. راجع الفوترة لدى المسؤول.";
  }

  // Keep a short English snippet so support can diagnose, but lead with Arabic.
  const snippet = text.replace(/\s+/g, " ").slice(0, 180);
  return `فشل BytePlus: ${snippet}`;
}

/**
 * Prefer the real upstream BytePlus reason when Assets still shows the old canned
 * privacy message from before we started translating API errors.
 */
export function displayBytePlusAssetError(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const t = stored.trim();
  if (!t) return null;

  const isLegacyCannedPrivacy =
    t.includes("صور الشخصيات تبدو كصور أشخاص حقيقيين") ||
    (t.includes("صور رقمية / كرتون / AI") && t.includes("صور أشخاص حقيقيين"));

  if (isLegacyCannedPrivacy) {
    return "رفض BytePlus الصورة لأنها تبدو كشخص حقيقي (خصوصية الوجوه). استخدم صورة شخصية رقمية أو رندر 3D أو رسمة واضحة للوجه والجسد.";
  }

  return translateBytePlusError(t, t);
}
