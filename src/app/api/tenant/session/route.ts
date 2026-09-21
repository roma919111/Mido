import { NextResponse } from "next/server";
import { findVoiceTenantBySlug } from "@/lib/voice-tenant-store";
import {
  getTenantIdFromPortalCookie,
  issueTenantPortalCookie,
  verifyPortalAccessToken,
} from "@/lib/tenant-portal-auth";
import { parseTenantSlugFromHost } from "@/lib/tenant-host";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug =
    parseTenantSlugFromHost(request.headers.get("host")) ||
    url.searchParams.get("slug")?.trim().toLowerCase() ||
    "";
  if (!slug) {
    return NextResponse.json({ error: "tenant slug required" }, { status: 400 });
  }

  const tenant = await findVoiceTenantBySlug(slug);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const cookieTenantId = await getTenantIdFromPortalCookie();
  const authed = cookieTenantId === tenant.id && tenant.status === "active";

  return NextResponse.json({
    ok: true,
    tenant: {
      slug: tenant.slug,
      registryNameAr: tenant.registryNameAr,
      registryNameEn: tenant.registryNameEn,
      activityLabel: tenant.activityLabel,
      status: tenant.status,
      phone: authed ? tenant.phone : undefined,
      assistantId: authed ? tenant.assistantId : undefined,
      uploads: authed
        ? tenant.uploads.map((u) => ({
            id: u.id,
            fileName: u.fileName,
            sizeBytes: u.sizeBytes,
            uploadedAt: u.uploadedAt,
            storage: u.storage,
          }))
        : [],
    },
    authed,
    needsAccessToken: tenant.status === "active" && !authed,
  });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const slug =
    parseTenantSlugFromHost(request.headers.get("host")) ||
    url.searchParams.get("slug")?.trim().toLowerCase() ||
    "";
  if (!slug) {
    return NextResponse.json({ error: "tenant slug required" }, { status: 400 });
  }

  const tenant = await findVoiceTenantBySlug(slug);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  if (tenant.status !== "active") {
    return NextResponse.json(
      { error: "الموقع غير مفعّل بعد — انتظر موافقة الإدارة والدفع" },
      { status: 403 },
    );
  }

  const body = (await request.json()) as { accessToken?: string };
  if (!verifyPortalAccessToken(tenant, body.accessToken)) {
    return NextResponse.json({ error: "رمز الدخول غير صحيح" }, { status: 401 });
  }

  await issueTenantPortalCookie(tenant.id);
  return NextResponse.json({ ok: true });
}
