import { NextResponse } from "next/server";
import { registerDevice } from "@/lib/max-activations";
import { maxApiCors } from "@/lib/max-api-cors";

export const runtime = "nodejs";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: maxApiCors });
}

/** Public: app registers on first launch (pending activation). */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    deviceId?: string;
    mac?: string;
    version?: string;
  };

  if (!body.deviceId?.trim()) {
    return NextResponse.json({ error: "deviceId required" }, { status: 400, headers: maxApiCors });
  }

  const record = await registerDevice({
    deviceId: body.deviceId,
    mac: body.mac,
    version: body.version,
  });

  return NextResponse.json(
    {
      deviceId: record.deviceId,
      activated: record.activated,
      label: record.label ?? null,
    },
    { headers: maxApiCors },
  );
}
