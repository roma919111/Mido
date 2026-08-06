import { NextResponse } from "next/server";
import {
  isMaxAdminAuthorized,
  listIptvCodes,
  renewIptvCode,
  setIptvCodeActive,
  updateIptvCodeMeta,
  upsertIptvCode,
} from "@/lib/iptv-codes";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isMaxAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const codes = await listIptvCodes();
  return NextResponse.json({ codes });
}

export async function POST(request: Request) {
  if (!isMaxAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    code?: string;
    label?: string;
    phone?: string;
    notes?: string;
    m3uUrl?: string;
    active?: boolean;
    planDays?: number | null;
  };

  if (!body.m3uUrl?.trim()) {
    return NextResponse.json({ error: "m3uUrl required" }, { status: 400 });
  }

  const record = await upsertIptvCode({
    code: body.code,
    label: body.label,
    phone: body.phone,
    notes: body.notes,
    m3uUrl: body.m3uUrl,
    active: body.active ?? true,
    planDays: body.planDays ?? 30,
  });

  return NextResponse.json({ ok: true, record });
}

export async function PATCH(request: Request) {
  if (!isMaxAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    code?: string;
    active?: boolean;
    renewDays?: number;
    label?: string;
    phone?: string;
    notes?: string;
  };

  if (!body.code) {
    return NextResponse.json({ error: "code required" }, { status: 400 });
  }

  if (body.renewDays && body.renewDays > 0) {
    const renewed = await renewIptvCode(body.code, body.renewDays);
    if (!renewed) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, record: renewed });
  }

  if (body.label !== undefined || body.phone !== undefined || body.notes !== undefined) {
    const updated = await updateIptvCodeMeta(body.code, {
      label: body.label,
      phone: body.phone,
      notes: body.notes,
    });
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, record: updated });
  }

  const record = await setIptvCodeActive(body.code, body.active ?? false);
  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, record });
}
