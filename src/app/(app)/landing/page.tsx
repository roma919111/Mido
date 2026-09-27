import type { Metadata } from "next";
import { LandingExperimentApp } from "@/components/veronix/landing/LandingExperimentApp";
import { getRequestDictionary } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getRequestDictionary();
  const title =
    locale === "ar" ? "لاندينغ تجريبي · Vyronix" : "Landing preview · Vyronix";
  const description =
    locale === "ar"
      ? "مساحة تجربة لتصميم الواجهة الجديدة دون تغيير الصفحة الرئيسية."
      : "Sandbox to iterate on the new home UI without changing production.";

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "https://vyronix.app/landing" },
    robots: { index: false, follow: false },
  };
}

export default function LandingExperimentPage() {
  return <LandingExperimentApp />;
}
