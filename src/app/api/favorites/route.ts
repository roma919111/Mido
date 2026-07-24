import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { repository } from "@/lib/db/repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as { generationId?: string };
    if (!body.generationId) {
      return NextResponse.json({ error: "generationId is required" }, { status: 400 });
    }

    const result = await repository.toggleFavorite(user.id, body.generationId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Favorite failed" },
      { status: 400 },
    );
  }
}
