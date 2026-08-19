"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { createHrefForModel } from "@/lib/bottom-nav-models";
import { ModelLogo } from "@/components/veronix/ModelLogo";
import { modelProviderKey } from "@/lib/model-logos";
import { uniqueProviderModels } from "@/lib/unique-provider-models";
import { useLocale } from "@/components/veronix/LocaleProvider";

const LOGO_SIZE = 28;
const CELL_SIZE = 36;

export function ModelLogoGrid() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedModel = searchParams.get("model");
  const { t, dir } = useLocale();
  const models = uniqueProviderModels();

  return (
    <div dir={dir} className="mt-4">
      <p className="mb-2.5 text-xs font-medium tracking-wide text-white/40">
        {t.nav.modelsStrip}
      </p>
      <div
        className="grid grid-cols-8 gap-2 sm:grid-cols-10 md:grid-cols-12"
        aria-label={t.nav.modelsStrip}
      >
        {models.map((model) => {
          const href = createHrefForModel(model);
          const basePath = model.kind === "image" ? "/create/image" : "/create/video";
          const active = pathname.startsWith(basePath) && selectedModel === model.id;
          const provider = modelProviderKey(model);
          const providerLabel =
            provider === "seedance"
              ? "Seedance"
              : provider === "minimax"
                ? "MiniMax"
                : null;

          return (
            <Link
              key={provider}
              href={href}
              title={model.available ? model.name : `${model.name} · ${t.create.comingSoon}`}
              aria-label={model.name}
              className={`flex shrink-0 flex-col items-center gap-1 transition ${
                active
                  ? "opacity-100"
                  : model.available
                    ? "opacity-90 hover:opacity-100"
                    : "opacity-55"
              }`}
            >
              <span
                className={`flex aspect-square items-center justify-center rounded-xl border ${
                  active
                    ? "border-[#22f0ff]/40 bg-[#22f0ff]/10"
                    : model.available
                      ? "border-white/10 bg-white/[0.04] hover:border-white/20"
                      : "border-white/5 bg-white/[0.02]"
                }`}
                style={{ width: CELL_SIZE, height: CELL_SIZE }}
              >
                <ModelLogo model={model} size={LOGO_SIZE} />
              </span>
              {providerLabel ? (
                <span className="max-w-[3.25rem] truncate text-[9px] font-medium text-white/50">
                  {providerLabel}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
