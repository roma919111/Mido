import { handleIptvDeviceSession, iptvDeviceSessionOptions } from "@/lib/iptv-device-connect";

export const runtime = "nodejs";

/** Legacy alias — some proxies block the path segment "connect". */
export async function OPTIONS() {
  return iptvDeviceSessionOptions();
}

export async function POST(request: Request) {
  return handleIptvDeviceSession(request);
}
