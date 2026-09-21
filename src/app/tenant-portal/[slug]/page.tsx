import type { Metadata } from "next";
import { VoiceTenantPortalApp } from "@/components/veronix/voice/VoiceTenantPortalApp";
import { findVoiceTenantBySlug } from "@/lib/voice-tenant-store";
import { tenantHostFromSlug } from "@/lib/tenant-slug";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ access?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await findVoiceTenantBySlug(slug);
  const title = tenant?.registryNameAr || slug;
  return {
    title: { absolute: `${title} · Vyronix Voice` },
    robots: { index: false, follow: false },
    alternates: tenant
      ? { canonical: `https://${tenantHostFromSlug(tenant.slug)}/` }
      : undefined,
  };
}

export default async function TenantPortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ access?: string }>;
}) {
  const { slug } = await params;
  const { access } = await searchParams;
  return <VoiceTenantPortalApp slug={slug.toLowerCase()} initialAccessToken={access} />;
}
