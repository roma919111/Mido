"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { persistReferralCodeClient } from "@/lib/referral-shared";
import { fetchJson } from "@/lib/fetch-json";

/** Capture ?ref= on any landing page and persist for signup. */
export function ReferralCapture() {
  const params = useSearchParams();

  useEffect(() => {
    const ref = params.get("ref")?.trim();
    if (!ref) return;
    persistReferralCodeClient(ref);
    void fetchJson("/api/referral/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: ref }),
    });
  }, [params]);

  return null;
}
