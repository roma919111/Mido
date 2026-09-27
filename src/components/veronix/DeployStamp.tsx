"use client";

import { useEffect, useState } from "react";
import { VYRONIX_BUILD_STAMP } from "@/lib/vyronix-build";

type Props = { className?: string };

/** Shows live build stamp from GET /api/health (production DeployStamp parity). */
export function DeployStamp({ className }: Props) {
  const [build, setBuild] = useState(VYRONIX_BUILD_STAMP);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/health?build=${Date.now()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { build?: string } | null) => {
        if (!cancelled && data?.build?.trim()) setBuild(data.build.trim());
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return <p className={className}>{build}</p>;
}
