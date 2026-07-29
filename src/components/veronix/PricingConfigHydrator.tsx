"use client";

import { useEffect } from "react";
import { fetchJson } from "@/lib/fetch-json";
import {
  setActivePricingConfig,
  type VeronixPricingConfig,
} from "@/lib/byteplus-pricing";

/** Pull admin-approved pack rates into client credit quotes. */
export function PricingConfigHydrator() {
  useEffect(() => {
    void (async () => {
      try {
        const { res, data } = await fetchJson<{
          config?: VeronixPricingConfig;
        }>("/api/pricing/config");
        if (res.ok && data.config) setActivePricingConfig(data.config);
      } catch {
        // keep defaults
      }
    })();
  }, []);

  return null;
}
