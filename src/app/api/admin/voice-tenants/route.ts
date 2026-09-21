import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { searchCommercialRegistry } from "@/lib/commercial-registry-search";
import {
  activateVoiceTenantAfterPayment,
  approveVoiceTenant,
  createVoiceTenantRequest,
  findVoiceTenantById,
  listVoiceTenants,
  rejectVoiceTenant,
  setVoiceTenantSlug,
} from "@/lib/voice-tenant-store";
import { tenantHostFromSlug } from "@/lib/tenant-slug";
import { tenantStorageMode } from "@/lib/tenant-s3";

export const runtime = "nodejs";

type Body = {
  action?:
    | "search"
    | "create_request"
    | "approve"
    | "reject"
    | "activate"
    | "set_slug";
  crNumber?: string;
  tenantId?: string;
  reason?: string;
  slug?: string;
};

function publicTenant(row: Awaited<ReturnType<typeof listVoiceTenants>>[number]) {
  return {
    ...row,
    portalAccessToken: row.status === "active" ? row.portalAccessToken : undefined,
    host: tenantHostFromSlug(row.slug),
  };
}

export async function GET() {
  try {
    await requireAdminUser();
    const tenants = await listVoiceTenants();
    return NextResponse.json({
      ok: true,
      storageMode: tenantStorageMode(),
      tenants: tenants.map(publicTenant),
    });
  } catch (error) {
    const status = (error as { status?: number }).status || 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Admin denied" },
      { status },
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminUser();
    const body = (await request.json()) as Body;
    const action = body.action;
    if (!action) {
      return NextResponse.json({ error: "action required" }, { status: 400 });
    }

    if (action === "search") {
      const cr = body.crNumber?.trim() || "";
      const hit = searchCommercialRegistry(cr);
      if (!hit) {
        return NextResponse.json({ error: "رقم السجل غير صالح" }, { status: 400 });
      }
      return NextResponse.json({ ok: true, hit });
    }

    if (action === "create_request") {
      const cr = body.crNumber?.trim() || "";
      const tenant = await createVoiceTenantRequest(cr);
      return NextResponse.json({ ok: true, tenant: publicTenant(tenant) });
    }

    const tenantId = body.tenantId?.trim();
    if (!tenantId) {
      return NextResponse.json({ error: "tenantId required" }, { status: 400 });
    }

    const existing = await findVoiceTenantById(tenantId);
    if (!existing) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (action === "approve") {
      if (existing.status !== "pending_approval") {
        return NextResponse.json({ error: "الطلب ليس بانتظار الموافقة" }, { status: 400 });
      }
      const tenant = await approveVoiceTenant(tenantId);
      return NextResponse.json({ ok: true, tenant: publicTenant(tenant) });
    }

    if (action === "reject") {
      const tenant = await rejectVoiceTenant(tenantId, body.reason || "");
      return NextResponse.json({ ok: true, tenant: publicTenant(tenant) });
    }

    if (action === "activate") {
      if (existing.status !== "awaiting_payment" && existing.status !== "approved") {
        return NextResponse.json(
          { error: "يجب الموافقة أولاً ثم تأكيد الدفع" },
          { status: 400 },
        );
      }
      const tenant = await activateVoiceTenantAfterPayment(tenantId);
      return NextResponse.json({ ok: true, tenant: publicTenant(tenant) });
    }

    if (action === "set_slug") {
      const slug = body.slug?.trim();
      if (!slug) {
        return NextResponse.json({ error: "slug required" }, { status: 400 });
      }
      const tenant = await setVoiceTenantSlug(tenantId, slug);
      return NextResponse.json({ ok: true, tenant: publicTenant(tenant) });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (error) {
    const status = (error as { status?: number }).status || 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status },
    );
  }
}
