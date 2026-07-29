import { NextResponse } from "next/server";
import {
  LOCALE_COOKIE,
  normalizeLocale,
  type Locale,
} from "@/lib/i18n/dictionaries";

export const runtime = "nodejs";

type Body = { locale?: string };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const locale: Locale = normalizeLocale(body.locale);
    const res = NextResponse.json({ ok: true, locale });
    res.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }
}
