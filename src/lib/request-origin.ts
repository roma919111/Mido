import { getAppBaseUrl } from "@/lib/app-url";

/** Public origin for URLs returned to the browser (Railway/Vercel safe). */
export function getRequestPublicOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";

  if (forwardedHost) {
    const host = forwardedHost.split(",")[0]?.trim();
    if (host && !host.includes("0.0.0.0")) {
      return `${forwardedProto}://${host}`;
    }
  }

  const host = request.headers.get("host");
  if (host && !host.includes("0.0.0.0") && !host.startsWith("127.0.0.1")) {
    const proto = host.includes("localhost") ? "http" : forwardedProto;
    return `${proto}://${host}`;
  }

  try {
    const origin = new URL(request.url).origin;
    if (origin && !origin.includes("0.0.0.0")) return origin;
  } catch {
    /* fall through */
  }

  return getAppBaseUrl();
}
