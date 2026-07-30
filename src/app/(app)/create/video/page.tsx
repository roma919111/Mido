import type { Metadata } from "next";
import { Suspense } from "react";
import { CreatePage } from "@/components/veronix/CreatePage";
import { getRequestDictionary } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getRequestDictionary();
  return buildPageMetadata({
    locale,
    title: t.create.videoTitle,
    description: t.meta.createVideoDescription,
    path: "/create/video",
  });
}

export default function CreateVideoPage() {
  return (
    <Suspense fallback={<div className="p-8 text-white/50">Loading…</div>}>
      <CreatePage media="video" />
    </Suspense>
  );
}
