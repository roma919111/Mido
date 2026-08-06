"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  bottomNavModels,
  createHrefForModel,
} from "@/lib/bottom-nav-models";
import { ModelLogo } from "@/components/veronix/ModelLogo";
import { modelProviderKey } from "@/lib/model-logos";
import { useLocale } from "@/components/veronix/LocaleProvider";

export function BottomNavModelStrip() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedModel = searchParams.get("model");
  const { t, dir } = useLocale();
  const models = bottomNavModels();

  return (
    <div
      className="border-b border-white/8 bg-[#0b0d12]/98 px-2 py-1.5"
      dir={dir}
    >
      <p className="sr-only">{t.nav.modelsStrip}</p>
      <div
        className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label={t.nav.modelsStrip}
      >
        {models.map((model) => {
          const href = createHrefForModel(model);
          const basePath = model.kind === "image" ? "/create/image" : "/create/video";
          const active = pathname.startsWith(basePath) && selectedModel === model.id;

          const iconOnly = modelProviderKey(model) === "minimax";

          return (
            <Link
              key={model.id}
              href={href}
              title={model.available ? model.name : `${model.name} · ${t.create.comingSoon}`}
              aria-label={model.name}
              className={`flex shrink-0 items-center gap-1 rounded-xl border ${iconOnly ? "px-1 py-1" : "px-1.5 py-1"} transition ${
                active
                  ? "border-[#22f0ff]/40 bg-[#22f0ff]/10"
                  : model.available
                    ? "border-white/10 bg-white/[0.04] hover:border-white/20"
                    : "border-white/5 bg-white/[0.02] opacity-50"
              }`}
            >
              <ModelLogo model={model} size={20} />
              {iconOnly ? null : (
                <span className="max-w-[4.5rem] truncate text-[9px] font-semibold text-white/75">
                  {model.name.split(" ")[0]}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
