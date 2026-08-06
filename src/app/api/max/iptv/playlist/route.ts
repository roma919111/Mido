import { NextResponse } from "next/server";
import { fetchAndParseM3u } from "@/lib/m3u-parser";
import { ensureDemoCode, getIptvCode, isCodeValid, normalizeCode } from "@/lib/iptv-codes";
import { maxApiCors } from "@/lib/max-api-cors";

export const runtime = "nodejs";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: maxApiCors });
}

/** Public: customer enters code → get channel list (server loads M3U). */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  await ensureDemoCode(origin);

  const url = new URL(request.url);
  const code = normalizeCode(url.searchParams.get("code") ?? "");
  if (code.length < 4) {
    return NextResponse.json({ error: "code required" }, { status: 400, headers: maxApiCors });
  }

  const record = await getIptvCode(code);
  if (!record) {
    return NextResponse.json(
      { error: "الكود غير صحيح — تواصل مع المزود" },
      { status: 403, headers: maxApiCors },
    );
  }
  if (!record.active) {
    return NextResponse.json(
      { error: "الاشتراك موقوف — تواصل مع المزود للتجديد" },
      { status: 403, headers: maxApiCors },
    );
  }
  if (!isCodeValid(record)) {
    return NextResponse.json(
      { error: "انتهى اشتراكك — تواصل مع المزود للتجديد" },
      { status: 403, headers: maxApiCors },
    );
  }

  try {
    const channels = await fetchAndParseM3u(record.m3uUrl);
    const origin = new URL(request.url).origin;
    return NextResponse.json(
      {
        code: record.code,
        label: record.label ?? null,
        expiresAt: record.expiresAt ?? null,
        channels: channels.map((c) => ({
          id: c.id,
          name: c.name,
          group: c.group ?? null,
          logo: c.logo ?? null,
          url: `${origin}/api/max/iptv/proxy?code=${encodeURIComponent(record.code)}&id=${encodeURIComponent(c.id)}`,
        })),
      },
      { headers: maxApiCors },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Playlist error";
    return NextResponse.json({ error: msg }, { status: 502, headers: maxApiCors });
  }
}
