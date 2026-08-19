"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";

/**
 * Edge floating WhatsApp support chip («الدعم الفني»).
 * Number from NEXT_PUBLIC_WHATSAPP_NUMBER or runtime /api/config/public
 * (Railway: WHATSAPP_SUPPORT_NUMBER / NEXT_PUBLIC_WHATSAPP_NUMBER).
 */
export function WhatsAppSupport() {
  const [href, setHref] = useState<string | null>(() => {
    const n = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "").replace(/\D/g, "");
    if (!n) return null;
    return `https://wa.me/${n}?text=${encodeURIComponent("مرحباً، أحتاج دعم فني في Vyronix AI Studio")}`;
  });

  useEffect(() => {
    if (href) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/config/public", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { whatsapp?: string | null };
        const n = String(data.whatsapp || "").replace(/\D/g, "");
        if (!n || cancelled) return;
        setHref(
          `https://wa.me/${n}?text=${encodeURIComponent("مرحباً، أحتاج دعم فني في Vyronix AI Studio")}`,
        );
      } catch {
        // hide until configured
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [href]);

  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      dir="rtl"
      aria-label="الدعم الفني عبر واتساب"
      className="fixed bottom-[5.75rem] left-3 z-[70] inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#128C7E] px-3 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(0,0,0,0.45)] transition hover:brightness-110 sm:bottom-24 sm:left-5"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
        <MessageCircle className="h-4 w-4" aria-hidden />
      </span>
      <span className="pr-1">الدعم الفني</span>
    </a>
  );
}
