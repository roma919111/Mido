import { useEffect, useState } from "react";
import { openPlatformNow } from "../lib/platform-open";
import { markCustomerBootDone } from "../lib/customer-mode";
import type { PlatformId } from "../types";

type CustomerBootProps = {
  onDone: () => void;
};

/** First launch only: opens Netflix immediately — no MAX home, no login. */
export function CustomerBoot({ onDone }: CustomerBootProps) {
  const [status, setStatus] = useState("جاري فتح Netflix…");

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const result = await openPlatformNow("netflix");
      if (cancelled) return;
      markCustomerBootDone();
      if (result === "store") {
        setStatus("📥 ثبّت Netflix من المتجر — سجّل دخولك مرة واحدة");
      } else if (result === "app") {
        setStatus("✓ Netflix — سجّل دخولك إن لم تكن مسجّلاً");
      } else {
        setStatus("🌐 Netflix في المتصفح");
      }
      window.setTimeout(onDone, 1200);
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [onDone]);

  return (
    <div className="customer-boot">
      <div className="customer-boot__card">
        <div className="customer-boot__logo">MAX</div>
        <h1>مرحباً</h1>
        <p className="customer-boot__status">{status}</p>
        <p className="customer-boot__hint">
          خطوة واحدة — Netflix يفتح الآن. لا حاجة لكلمة مرور MAX.
        </p>
      </div>
    </div>
  );
}

export function openPreferredPlatform(platform: PlatformId = "netflix") {
  return openPlatformNow(platform);
}
