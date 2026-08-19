import { readDeviceCookie } from "@/lib/iptv-device-cookie";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const identity = await readDeviceCookie();
  if (!identity) {
    return NextResponse.json({ identity: null });
  }
  return NextResponse.json({
    identity: {
      mac: identity.mac,
      devicePin: identity.devicePin,
    },
  });
}
