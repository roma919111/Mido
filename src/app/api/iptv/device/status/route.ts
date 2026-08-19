import { NextResponse } from "next/server";
import { writeDeviceCookie } from "@/lib/iptv-device-cookie";
import { resolveIptvDevice, touchIptvDevice } from "@/lib/iptv-device-store";

export const runtime = "nodejs";

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

/** Fast activation check — does NOT load IPTV catalog. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mac = url.searchParams.get("mac")?.trim() ?? "";
  const devicePin = url.searchParams.get("devicePin")?.trim() ?? "";

  if (!mac || !devicePin) {
    return NextResponse.json({ error: "mac and devicePin required" }, { status: 400, headers: corsHeaders() });
  }

  try {
    const device = await resolveIptvDevice(mac, devicePin);
    if (!device) {
      return NextResponse.json({ status: "not_found" }, { headers: corsHeaders() });
    }

    await touchIptvDevice(device.mac, device.devicePin);
    await writeDeviceCookie(device.mac, device.devicePin);

    if (device.status === "disabled") {
      return NextResponse.json({ status: "disabled" }, { headers: corsHeaders() });
    }

    if (device.status !== "active" || !device.host || !device.username || !device.password) {
      return NextResponse.json(
        { status: "pending", mac: device.mac, devicePin: device.devicePin },
        { headers: corsHeaders() },
      );
    }

    return NextResponse.json(
      {
        status: "active",
        label: device.customerNote || device.username,
        mac: device.mac,
        devicePin: device.devicePin,
      },
      { headers: corsHeaders() },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Status error";
    return NextResponse.json({ error: msg }, { status: 400, headers: corsHeaders() });
  }
}
