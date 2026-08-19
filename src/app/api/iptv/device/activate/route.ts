import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { formatExpiryAr, parseAdminExpiryIso } from "@/lib/iptv-device-fields";
import { activateIptvDevice, listIptvDevices, toAdminIptvDevice } from "@/lib/iptv-device-store";
import { verifyXtreamLogin, type XtreamAccountInfo } from "@/lib/xtream-url";

export const runtime = "nodejs";

function parseXtreamExpiryIso(info: XtreamAccountInfo): string | undefined {
  const expRaw = info.user_info?.exp_date?.toString().trim() ?? "";
  if (!expRaw || expRaw === "0") return undefined;
  let expMs: number;
  if (/^\d+$/.test(expRaw)) {
    const n = Number(expRaw);
    expMs = n > 1e12 ? n : n * 1000;
  } else {
    expMs = Date.parse(expRaw);
  }
  if (!Number.isFinite(expMs) || expMs < Date.parse("2020-01-01T00:00:00Z")) return undefined;
  return new Date(expMs).toISOString();
}

export async function GET(request: Request) {
  try {
    await requireAdminUser();
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    const devices = await listIptvDevices(500, query);
    return NextResponse.json({ devices: devices.map(toAdminIptvDevice) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    const status = msg.includes("Unauthorized") || msg.includes("Admin") ? 401 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}

type ActivateBody = {
  mac?: string;
  devicePin?: string;
  host?: string;
  username?: string;
  password?: string;
  customerNote?: string;
  customerPhone?: string;
  expiresAt?: string;
};

export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser();
    const body = (await request.json()) as ActivateBody;
    const host = body.host ?? "";
    const username = body.username ?? "";
    const password = body.password ?? "";

    let expiresAt = parseAdminExpiryIso(body.expiresAt);
    if (!expiresAt && host && username && password) {
      const info = await verifyXtreamLogin({ host, username, password }).catch(() => null);
      if (info) expiresAt = parseXtreamExpiryIso(info);
    }

    const record = await activateIptvDevice({
      mac: body.mac ?? "",
      devicePin: body.devicePin ?? "",
      host,
      username,
      password,
      customerNote: body.customerNote,
      customerPhone: body.customerPhone ?? "",
      expiresAt,
      activatedBy: admin.email,
    });

    return NextResponse.json({
      ok: true,
      device: toAdminIptvDevice(record),
      expiresLabel: formatExpiryAr(record.expiresAt),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Activation failed";
    const status =
      msg.includes("Unauthorized") || msg.includes("Admin") ? 401 : msg.includes("يجب") || msg.includes("مطلوب") || msg.includes("غير صحيح") ? 400 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
