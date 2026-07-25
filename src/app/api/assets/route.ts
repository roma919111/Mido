import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import { listAssetsForUser } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required", needsAuth: true }, { status: 401 });
  }
  const assets = await listAssetsForUser(user.id);
  return NextResponse.json({ assets });
}
