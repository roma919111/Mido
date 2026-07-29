/**
 * Customer support contact (WhatsApp floating button).
 * Set NEXT_PUBLIC_WHATSAPP_NUMBER to digits with country code, e.g. 2126XXXXXXXX
 */
export function getWhatsAppSupportNumber(): string {
  const raw =
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.trim() ||
    process.env.WHATSAPP_SUPPORT_NUMBER?.trim() ||
    "";
  return raw.replace(/\D/g, "");
}

export function whatsAppSupportHref(prefill?: string): string | null {
  const n = getWhatsAppSupportNumber();
  if (!n) return null;
  const text =
    prefill ||
    "مرحباً، أحتاج دعم فني في Veronix.ai";
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}
