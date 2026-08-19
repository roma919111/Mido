import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { listMediaPlayerOrders } from "@/lib/media-player-orders";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdminUser();
    const orders = await listMediaPlayerOrders(200);
    return NextResponse.json({ orders });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    const status = msg.includes("Admin") || msg.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
