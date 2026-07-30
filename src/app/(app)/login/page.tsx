import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/veronix/AuthForm";
import { BottomNav } from "@/components/veronix/BottomNav";
import { getRequestDictionary } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getRequestDictionary();
  return buildPageMetadata({
    locale,
    title: t.auth.loginTitle,
    description: t.meta.loginDescription,
    path: "/login",
  });
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#0b0d12] text-white">
      <Suspense fallback={<div className="p-8 text-white/50">Loading…</div>}>
        <AuthForm mode="login" />
      </Suspense>
      <BottomNav />
    </div>
  );
}
