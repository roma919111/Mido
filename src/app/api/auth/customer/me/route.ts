import { NextResponse } from "next/server";
import { getCurrentUser, publicUser } from "@/lib/customer-auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null, authenticated: false });
  }
  return NextResponse.json({ user: publicUser(user), authenticated: true });
}
