"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { persistReferralCodeClient } from "@/lib/referral-shared";
import { fetchJson } from "@/lib/fetch-json";
import { MEDIA_PLAYER_ACTIVATE_PATH, MEDIA_PLAYER_LANDING_PATH } from "@/lib/media-player-commerce";

/** Capture ?ref= on any landing page and persist for signup. */
export function ReferralCapture() {
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    if (
      pathname === "/player" ||
      pathname.startsWith("/player/") ||
      pathname === MEDIA_PLAYER_LANDING_PATH ||
      pathname.startsWith(`${MEDIA_PLAYER_LANDING_PATH}/`) ||
      pathname === "/vyronixmaxmediaplayer" ||
      pathname.startsWith("/vyronixmaxmediaplayer") ||
      pathname === MEDIA_PLAYER_ACTIVATE_PATH ||
      pathname.startsWith(`${MEDIA_PLAYER_ACTIVATE_PATH}/`) ||
      pathname.startsWith("/maxvyronixmerdia") ||
      pathname.startsWith("/maxvyronixmedia") ||
      pathname.startsWith("/maxvronixmedia")
    ) {
      return;
    }
    const ref = params.get("ref")?.trim();
    if (!ref) return;
    persistReferralCodeClient(ref);
    void fetchJson("/api/referral/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: ref }),
    });
  }, [params, pathname]);

  return null;
}
