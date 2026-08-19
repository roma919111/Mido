import { NextResponse } from "next/server";
import { getCurrentUser, publicUser } from "@/lib/customer-auth";
import { updateUser } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Login required", needsAuth: true }, { status: 401 });
    }

    const body = (await request.json()) as { name?: string };
    const name = body.name?.trim();
    if (!name || name.length < 2) {
      return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
    }
    if (name.length > 40) {
      return NextResponse.json({ error: "Name is too long (max 40)" }, { status: 400 });
    }

    const updated = await updateUser(user.id, { name });
    return NextResponse.json({ user: publicUser(updated) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 422 },
    );
  }
}
