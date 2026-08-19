import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPanelPage } from "@/components/veronix/AdminPanelPage";
import { requireAdminPage } from "@/lib/admin-page-gate";

export const metadata: Metadata = {
  title: "لوحة التحكم",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ tab?: string | string[] }>;

export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  await requireAdminPage(tab === "player" ? "/admin?tab=player" : "/admin");
  return (
    <Suspense fallback={null}>
      <AdminPanelPage />
    </Suspense>
  );
}
