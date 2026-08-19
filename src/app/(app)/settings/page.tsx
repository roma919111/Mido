import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsPage } from "@/components/veronix/SettingsPage";
import { getRequestDictionary } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestDictionary();
  return {
    title: { absolute: t.settings.title },
    robots: { index: false, follow: false },
  };
}

export default function SettingsRoutePage() {
  return (
    <Suspense fallback={null}>
      <SettingsPage />
    </Suspense>
  );
}
