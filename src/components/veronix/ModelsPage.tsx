"use client";

import Link from "next/link";
import { AppHeader } from "@/components/veronix/AppHeader";
import { BottomNav } from "@/components/veronix/BottomNav";
import { ModelLogo } from "@/components/veronix/ModelLogo";
import { useLocale } from "@/components/veronix/LocaleProvider";
import { useCustomerUser } from "@/hooks/useCustomerUser";
import { ALL_MODELS, type CatalogModel } from "@/lib/model-catalog";
import { modelPagePath } from "@/lib/model-seo";

function ModelCard({ model, labels }: { model: CatalogModel; labels: { available: string; soon: string; video: string; image: string; cta: string } }) {
  return (
    <Link
      href={modelPagePath(model)}
      className={`rounded-2xl border px-4 py-4 transition ${
        model.available
          ? "border-white/10 bg-[#141821] hover:border-[#22f0ff]/30"
          : "border-white/5 bg-white/[0.02] opacity-70"
      }`}
    >
      <div className="flex items-start gap-3">
        <ModelLogo model={model} size={28} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-white">{model.name}</h2>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/55">
              {model.kind === "video" ? labels.video : labels.image}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                model.available
                  ? "bg-emerald-500/15 text-emerald-200"
                  : "bg-white/8 text-white/45"
              }`}
            >
              {model.available ? labels.available : labels.soon}
            </span>
          </div>
          {model.tagline ? (
            <p className="mt-1.5 text-sm leading-relaxed text-white/50">{model.tagline}</p>
          ) : null}
          <p className="mt-2 text-xs font-semibold text-[#22f0ff]/80">{labels.cta} →</p>
        </div>
      </div>
    </Link>
  );
}

export function ModelsPage() {
  const { t, dir } = useLocale();
  const { user, refreshUser, logout, ready, refreshing } = useCustomerUser();
  const videoModels = ALL_MODELS.filter((m) => m.kind === "video");
  const imageModels = ALL_MODELS.filter((m) => m.kind === "image");
  const labels = {
    available: t.models.available,
    soon: t.models.soon,
    video: t.models.video,
    image: t.models.image,
    cta: t.models.detailCta,
  };

  return (
    <div className="min-h-screen bg-[#0b0d12] text-white">
      <AppHeader
        user={user}
        ready={ready}
        refreshing={refreshing}
        onLogout={() => void logout()}
      />
      <main className="mx-auto max-w-4xl px-4 pb-bottom-nav pt-8 sm:px-6" dir={dir}>
        <p className="text-xs uppercase tracking-[0.2em] text-[#22f0ff]/80">{t.models.eyebrow}</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold">{t.models.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">{t.models.subtitle}</p>

        <section className="mt-10">
          <h2 className="font-display text-xl font-bold">{t.models.videoTitle}</h2>
          <p className="mt-1 text-sm text-white/45">{t.models.videoSub}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {videoModels.map((model) => (
              <ModelCard key={model.id} model={model} labels={labels} />
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-xl font-bold">{t.models.imageTitle}</h2>
          <p className="mt-1 text-sm text-white/45">{t.models.imageSub}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {imageModels.map((model) => (
              <ModelCard key={model.id} model={model} labels={labels} />
            ))}
          </div>
        </section>

        <p className="mt-10 text-sm text-white/40">{t.models.footerNote}</p>
      </main>
      <BottomNav />
    </div>
  );
}
