import { type NextRequest, NextResponse } from "next/server";
import { LOCAL_SESSION_COOKIE } from "@/lib/auth/constants";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { updateSession } from "@/lib/supabase/middleware";

const PROTECTED = [
  "/create",
  "/library",
  "/settings",
  "/workflows",
  "/models",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isSupabaseConfigured()) {
    const response = await updateSession(request);
    return response;
  }

  const hasLocalSession = Boolean(request.cookies.get(LOCAL_SESSION_COOKIE)?.value);
  const isProtected = PROTECTED.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (isProtected && !hasLocalSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
