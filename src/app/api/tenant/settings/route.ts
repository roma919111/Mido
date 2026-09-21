import { NextResponse } from "next/server";
import {
  findVoiceTenantById,
  findVoiceTenantBySlug,
  updateVoiceTenantSettings,
} from "@/lib/voice-tenant-store";
import { getTenantIdFromPortalCookie } from "@/lib/tenant-portal-auth";
import { parseTenantSlugFromHost } from "@/lib/tenant-host";

export const runtime = "nodejs";

async function requireAuthedTenant(request: Request) {
  const url = new URL(request.url);
  const slug =
    parseTenantSlugFromHost(request.headers.get("host")) ||
    url.searchParams.get("slug")?.trim().toLowerCase() ||
    "";
  if (!slug) throw Object.assign(new Error("tenant slug required"), { status: 400 });

  const tenant = await findVoiceTenantBySlug(slug);
  if (!tenant) throw Object.assign(new Error("Tenant not found"), { status: 404 });
  if (tenant.status !== "active") {
    throw Object.assign(new Error("Tenant not active"), { status: 403 });
  }

  const cookieId = await getTenantIdFromPortalCookie();
  if (cookieId !== tenant.id) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  return tenant;
}

export async function PATCH(request: Request) {
  try {
    const tenant = await requireAuthedTenant(request);
    const body = (await request.json()) as { phone?: string; assistantId?: string };
    const updated = await updateVoiceTenantSettings(tenant.id, body);
    return NextResponse.json({
      ok: true,
      phone: updated.phone,
      assistantId: updated.assistantId,
    });
  } catch (error) {
    const status = (error as { status?: number }).status || 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status },
    );
  }
}

export async function GET(request: Request) {
  try {
    const tenant = await requireAuthedTenant(request);
    const fresh = await findVoiceTenantById(tenant.id);
    return NextResponse.json({
      ok: true,
      phone: fresh?.phone,
      assistantId: fresh?.assistantId,
    });
  } catch (error) {
    const status = (error as { status?: number }).status || 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status },
    );
  }
}
