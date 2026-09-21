import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  appendVoiceTenantUpload,
  findVoiceTenantBySlug,
} from "@/lib/voice-tenant-store";
import { getTenantIdFromPortalCookie } from "@/lib/tenant-portal-auth";
import { parseTenantSlugFromHost } from "@/lib/tenant-host";
import { storeTenantDbFile, tenantStorageMode } from "@/lib/tenant-s3";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
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
      return NextResponse.json({ error: "Tenant not active" }, { status: 403 });
    }

    const cookieId = await getTenantIdFromPortalCookie();
    if (cookieId !== tenant.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeTenantDbFile({
      tenantSlug: tenant.slug,
      tenantId: tenant.id,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      body: buffer,
    });

    const uploadId = randomUUID();
    const now = new Date().toISOString();
    const updated = await appendVoiceTenantUpload(tenant.id, {
      id: uploadId,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      sizeBytes: buffer.length,
      storage: stored.storage,
      storageKey: stored.storageKey,
      uploadedAt: now,
    });

    const last = updated.uploads[updated.uploads.length - 1];
    return NextResponse.json({
      ok: true,
      storageMode: tenantStorageMode(),
      upload: last,
    });
  } catch (error) {
    const status = (error as { status?: number }).status || 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status },
    );
  }
}
