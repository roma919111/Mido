import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Built-in demo playlist for local testing (code: 123456). */
export async function GET() {
  const m3u = `#EXTM3U
#EXTINF:-1 group-title="تجربة",قناة تجريبية 1
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
#EXTINF:-1 group-title="تجربة",قناة تجريبية 2
https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8
`;

  return new NextResponse(m3u, {
    headers: {
      "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
