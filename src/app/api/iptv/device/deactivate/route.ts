import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { disableIptvDevice } from "@/lib/iptv-device-store";

export const runtime = "nodejs";

type DeactivateBody = {
  mac?: string;
  devicePin?: string;
};

/** Admin: cancel/disable an activated IPTV device. */
export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser();
    const body = (await request.json()) as DeactivateBody;
    const record = await disableIptvDevice(body.mac ?? "", body.devicePin ?? "", admin.email);

    return NextResponse.json({
      ok: true,
      device: {
        id: record.id,
        mac: record.mac,
        devicePin: record.devicePin,
        status: record.status,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Deactivate failed";
    const status =
      msg.includes("Unauthorized") || msg.includes("Admin") ? 401 : msg.includes("غير موجود") || msg.includes("يجب") ? 400 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
