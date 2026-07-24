import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { repository } from "@/lib/db/repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "40");

  const items = await repository.listGenerations({
    userId: user.id,
    viewerId: user.id,
    limit: Number.isFinite(limit) ? limit : 40,
  });

  return NextResponse.json({ items });
}
