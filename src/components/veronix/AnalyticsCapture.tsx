"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { trackSignUp } from "@/components/veronix/AnalyticsScripts";

/** Fire GA4 sign_up after Google OAuth redirect for brand-new accounts. */
export function AnalyticsCapture() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (params.get("ga_signup") !== "1") return;
    trackSignUp("google");
    const next = new URLSearchParams(params.toString());
    next.delete("ga_signup");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  return null;
}
