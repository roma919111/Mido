import { normalizeDigits } from "./normalize-digits";

/** Read activation code from ?code= in URL (magic link for customers). */
export function getCodeFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("code");
  if (!raw) return null;
  const code = normalizeDigits(raw, 6);
  return code.length >= 4 ? code : null;
}

/** Remove ?code= from address bar after auto-activation. */
export function clearCodeFromUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("code")) return;
  url.searchParams.delete("code");
  const next = url.pathname + (url.search ? url.search : "") + url.hash;
  window.history.replaceState({}, "", next);
}

export function buildCustomerLink(code: string, playerBase?: string): string {
  const base =
    playerBase?.trim() ||
    import.meta.env.VITE_PLAYER_PUBLIC_URL?.trim() ||
    (typeof window !== "undefined" ? window.location.origin + window.location.pathname : "");
  const root = base.replace(/\/$/, "");
  return `${root}/?code=${encodeURIComponent(code)}`;
}

export function buildWhatsAppMessage(link: string, label?: string): string {
  const name = label?.trim() ? ` ${label.trim()}` : "";
  return (
    `مرحباً${name}! 👋\n\n` +
    `MAX Media Player جاهز — اضغط الرابط:\n${link}\n\n` +
    `• القنوات جاهزة\n• Netflix / شاهد / TOD بزر واحد\n• بدون إعداد — افتح واستمتع`
  );
}
