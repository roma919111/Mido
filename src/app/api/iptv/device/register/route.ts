import { NextResponse } from "next/server";
import { writeDeviceCookie } from "@/lib/iptv-device-cookie";
import { registerIptvDevice } from "@/lib/iptv-device-store";

export const runtime = "nodejs";

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request) {
  let body: { mac?: string; devicePin?: string };
  try {
    body = (await request.json()) as { mac?: string; devicePin?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders() });
  }

  try {
    const record = await registerIptvDevice(body.mac ?? "", body.devicePin ?? "");
    await writeDeviceCookie(record.mac, record.devicePin);
    return NextResponse.json(
      {
        status: record.status,
        mac: record.mac,
        devicePin: record.devicePin,
      },
      { headers: corsHeaders() },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Register failed";
    return NextResponse.json({ error: msg }, { status: 400, headers: corsHeaders() });
  }
}
