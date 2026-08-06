"use client";

import Link from "next/link";
import { AppHeader } from "@/components/veronix/AppHeader";
import { BottomNav } from "@/components/veronix/BottomNav";
import { ModelLogo } from "@/components/veronix/ModelLogo";
import { useLocale } from "@/components/veronix/LocaleProvider";
import { useCustomerUser } from "@/hooks/useCustomerUser";
import type { CatalogModel } from "@/lib/model-catalog";
import { createHrefForModel } from "@/lib/bottom-nav-models";
import { modelPagePath } from "@/lib/model-seo";

export function ModelDetailPage({ model }: { model: CatalogModel }) {
  const { t, dir } = useLocale();
  const { user, refreshUser, logout, ready, refreshing } = useCustomerUser();
  const studioHref = createHrefForModel(model);

  return (
    <div className="min-h-screen bg-[#0b0d12] text-white">
      <AppHeader
        user={user}
        ready={ready}
        refreshing={refreshing}
        onLogout={() => void logout()}
      />
      <main className="mx-auto max-w-3xl px-4 pb-bottom-nav pt-8 sm:px-6" dir={dir}>
        <Link href="/models" className="text-sm text-[#22f0ff]/80 hover:text-[#22f0ff]">
          ← {t.footer.models}
        </Link>

        <div className="mt-6 flex items-start gap-4">
          <ModelLogo model={model} size={36} />
          <div>
            <h1 className="font-display text-3xl font-extrabold">{model.name}</h1>
            <p className="mt-1 text-sm text-white/45">
              {model.kind === "video" ? t.models.video : t.models.image}
              {" · "}
              {model.available ? t.models.available : t.models.soon}
            </p>
          </div>
        </div>

        {model.tagline ? (
          <p className="mt-5 text-base leading-relaxed text-white/65">{model.tagline}</p>
        ) : null}

        <section className="mt-8 rounded-2xl border border-white/10 bg-[#141821] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/45">
            {t.models.detailAbout}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            {model.kind === "video" ? t.models.detailVideoBody : t.models.detailImageBody}{" "}
            <strong className="font-semibold text-white">{model.name}</strong>
            {model.available ? t.models.detailAvailable : t.models.detailSoon}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={studioHref}
              className="inline-flex rounded-full bg-[linear-gradient(135deg,#7c5cff,#22f0ff)] px-5 py-2.5 text-sm font-bold text-white"
            >
              {t.models.detailCta}
            </Link>
            <Link
              href="/pricing"
              className="inline-flex rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white/80"
            >
              {t.footer.pricing}
            </Link>
          </div>
        </section>

        <p className="mt-6 text-xs text-white/35" dir="ltr">
          {modelPagePath(model)}
        </p>
      </main>
      <BottomNav />
    </div>
  );
}
