import { NextResponse } from "next/server";
import {
  isMaxAdminAuthorized,
  listIptvCodes,
  setIptvCodeActive,
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
    m3uUrl?: string;
    active?: boolean;
  };

  if (!body.m3uUrl?.trim()) {
    return NextResponse.json({ error: "m3uUrl required" }, { status: 400 });
  }

  const record = await upsertIptvCode({
    code: body.code,
    label: body.label,
    m3uUrl: body.m3uUrl,
    active: body.active ?? true,
  });

  return NextResponse.json({ ok: true, record });
}

export async function PATCH(request: Request) {
  if (!isMaxAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { code?: string; active?: boolean };
  if (!body.code) {
    return NextResponse.json({ error: "code required" }, { status: 400 });
  }

  const record = await setIptvCodeActive(body.code, body.active ?? false);
  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, record });
}
