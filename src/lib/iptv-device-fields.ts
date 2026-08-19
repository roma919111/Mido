export function normalizeCustomerPhone(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("رقم هاتف الزبون مطلوب");
  const plus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) {
    throw new Error("رقم هاتف الزبون غير صحيح");
  }
  return plus ? `+${digits}` : digits;
}

export function parseAdminExpiryIso(raw: string | undefined): string | undefined {
  const value = raw?.trim() ?? "";
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const ms = Date.parse(`${value}T23:59:59+03:00`);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
}

export function expiryDateInputValue(iso?: string): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date(ms));
}

export function formatGregorianAr(ms: number, withYear = true): string {
  return new Intl.DateTimeFormat("ar-GB", {
    calendar: "gregory",
    numberingSystem: "latn",
    timeZone: "Asia/Riyadh",
    weekday: "short",
    day: "numeric",
    month: "long",
    year: withYear ? "numeric" : undefined,
  }).format(new Date(ms));
}

export function formatExpiryAr(iso?: string): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return formatGregorianAr(ms);
}

export function daysLeftFromIso(iso?: string): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.ceil((ms - Date.now()) / 86400000);
}
