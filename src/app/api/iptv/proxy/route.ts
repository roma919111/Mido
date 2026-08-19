import { handleIptvMediaProxy, iptvProxyOptions } from "@/lib/iptv-media-proxy";

export const runtime = "nodejs";
export const maxDuration = 7200;

export async function OPTIONS() {
  return iptvProxyOptions();
}

export async function GET(request: Request) {
  return handleIptvMediaProxy(request);
}
