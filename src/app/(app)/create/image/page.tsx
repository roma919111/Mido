import type { Metadata } from "next";
import { Suspense } from "react";
import { CreatePage } from "@/components/veronix/CreatePage";
import { getRequestDictionary } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getRequestDictionary();
  return buildPageMetadata({
    locale,
    title: t.create.imageTitle,
    description: t.meta.createImageDescription,
    path: "/create/image",
  });
}

export default function CreateImagePage() {
  return (
    <Suspense fallback={<div className="p-8 text-white/50">Loading…</div>}>
      <CreatePage media="image" />
    </Suspense>
  );
}
