import { NextResponse } from "next/server";
import {
  activateDevice,
  deactivateDevice,
  getActivation,
  isMaxAdminAuthorized,
  normalizeDeviceId,
} from "@/lib/max-activations";
import { maxApiCors } from "@/lib/max-api-cors";

export const runtime = "nodejs";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: maxApiCors });
}

/** Public: app polls this to see if device is activated. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const deviceId = normalizeDeviceId(url.searchParams.get("deviceId") ?? "");
  if (!deviceId) {
    return NextResponse.json({ error: "deviceId required" }, { status: 400, headers: maxApiCors });
  }

  const record = await getActivation(deviceId);
  return NextResponse.json(
    {
      deviceId,
      activated: record?.activated ?? false,
      label: record?.label ?? null,
    },
    { headers: maxApiCors },
  );
}

/** Admin: activate a device by ID. */
export async function POST(request: Request) {
  if (!isMaxAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { deviceId?: string; label?: string };
  if (!body.deviceId?.trim()) {
    return NextResponse.json({ error: "deviceId required" }, { status: 400 });
  }

  const record = await activateDevice({
    deviceId: body.deviceId,
    label: body.label,
  });

  return NextResponse.json({ ok: true, record });
}

/** Admin: deactivate a device. */
export async function DELETE(request: Request) {
  if (!isMaxAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const deviceId = url.searchParams.get("deviceId") ?? "";
  if (!deviceId.trim()) {
    return NextResponse.json({ error: "deviceId required" }, { status: 400 });
  }

  const record = await deactivateDevice(deviceId);
  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, record });
}
