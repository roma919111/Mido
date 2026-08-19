import { NextResponse } from "next/server";
import { writeDeviceCookie } from "@/lib/iptv-device-cookie";
import type { IptvDeviceRecord } from "@/lib/iptv-device-store";
import { resolveIptvDevice, saveDeviceSession, touchIptvDevice } from "@/lib/iptv-device-store";
import { categoriesFromXtream, createIptvSession, getIptvSession, listIptvCategories } from "@/lib/iptv-session-cache";
import { getPlayerMediaOrigin } from "@/lib/request-origin";
import {
  fetchXtreamLiveCategories,
  fetchXtreamSeriesCategories,
  fetchXtreamVodCategories,
  normalizeHost,
  verifyXtreamLogin,
  xtreamHostFallbacks,
  type XtreamCategory,
} from "@/lib/xtream-url";

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function buildLoginFromCache(device: IptvDeviceRecord, sessionId: string, origin: string) {
  const session = getIptvSession(sessionId);
  if (!session) return null;
  session.origin = origin;

  const liveCategories = session.live.length
    ? listIptvCategories(session.live)
    : session.liveCategoryMeta
      ? categoriesFromXtream(session.liveCategoryMeta, null, 0)
      : [];

  return {
    status: "active" as const,
    sessionId,
    host: normalizeHost(device.host!),
    username: device.username!,
    label: device.customerNote || device.username!,
    source: "api" as const,
    totals: { live: session.live.length || liveCategories.length, movies: null, series: null },
    liveCategories,
    movieCategories: session.vodCategories ? categoriesFromXtream(session.vodCategories, null, 0) : [],
    seriesCategories: session.seriesCategories ? categoriesFromXtream(session.seriesCategories, null, 0) : [],
    mac: device.mac,
    devicePin: device.devicePin,
  };
}

/** Create or reuse player session for an activated device. */
export async function handleIptvDeviceSession(request: Request): Promise<Response> {
  let body: { mac?: string; devicePin?: string };
  try {
    body = (await request.json()) as { mac?: string; devicePin?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders() });
  }

  const mac = body.mac?.trim() ?? "";
  const devicePin = body.devicePin?.trim() ?? "";

  if (!mac || !devicePin) {
    return NextResponse.json({ error: "mac and devicePin required" }, { status: 400, headers: corsHeaders() });
  }

  try {
    const device = await resolveIptvDevice(mac, devicePin);
    if (!device || device.status !== "active" || !device.host || !device.username || !device.password) {
      return NextResponse.json({ error: "الجهاز غير مفعّل بعد — تأكد من MAC ورقم الجهاز" }, { status: 403, headers: corsHeaders() });
    }

    await touchIptvDevice(device.mac, device.devicePin);
    await writeDeviceCookie(device.mac, device.devicePin);
    const origin = getPlayerMediaOrigin(request);

    if (device.cachedSessionId) {
      const reused = buildLoginFromCache(device, device.cachedSessionId, origin);
      if (reused) {
        return NextResponse.json(reused, { headers: corsHeaders() });
      }
    }

    const hosts = xtreamHostFallbacks(device.host);
    let liveCategoryMeta: XtreamCategory[] = [];
    let vodCategories: XtreamCategory[] = [];
    let seriesCategories: XtreamCategory[] = [];
    let connectedHost = hosts[0];
    let lastError = "";

    for (const candidate of hosts) {
      const creds = {
        host: candidate,
        username: device.username,
        password: device.password,
      };
      try {
        const [live, vod, series] = await Promise.all([
          fetchXtreamLiveCategories(creds),
          fetchXtreamVodCategories(creds),
          fetchXtreamSeriesCategories(creds),
        ]);
        if (live.length || vod.length || series.length) {
          liveCategoryMeta = live;
          vodCategories = vod;
          seriesCategories = series;
          connectedHost = candidate;
          lastError = "";
          break;
        }
        const info = await verifyXtreamLogin(creds);
        if (info) {
          connectedHost = candidate;
          lastError = "";
          break;
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : "تعذّر الاتصال بالسيرفر";
      }
    }

    if (lastError && !liveCategoryMeta.length && !vodCategories.length && !seriesCategories.length) {
      throw new Error(lastError || "تعذّر الاتصال بالسيرفر — تأكد أن Host يبدأ بـ http://");
    }

    const creds = {
      host: connectedHost,
      username: device.username,
      password: device.password,
    };

    const sessionId = createIptvSession([], creds, origin, liveCategoryMeta);
    const session = getIptvSession(sessionId);
    if (session) {
      session.vodCategories = vodCategories;
      session.seriesCategories = seriesCategories;
    }
    const liveCategories = categoriesFromXtream(liveCategoryMeta, null, 0);

    await saveDeviceSession(device.mac, device.devicePin, sessionId);

    return NextResponse.json(
      {
        status: "active",
        sessionId,
        host: creds.host,
        username: creds.username,
        label: device.customerNote || creds.username,
        source: "api",
        totals: { live: liveCategories.length, movies: vodCategories.length || null, series: seriesCategories.length || null },
        liveCategories,
        movieCategories: categoriesFromXtream(vodCategories, null, 0),
        seriesCategories: categoriesFromXtream(seriesCategories, null, 0),
        mac: device.mac,
        devicePin: device.devicePin,
      },
      { headers: corsHeaders() },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Connect error";
    return NextResponse.json({ error: msg }, { status: 502, headers: corsHeaders() });
  }
}

export function iptvDeviceSessionOptions(): Response {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
