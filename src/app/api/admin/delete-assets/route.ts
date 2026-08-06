import { NextResponse } from "next/server";
import { deleteAllAssetsForUser, findUserByEmail } from "@/lib/db";

export const runtime = "nodejs";

type Body = {
  email?: string;
};

/**
 * Ops: soft-delete all assets for a customer account.
 * Requires x-admin-secret = AUTH_SECRET.
 */
export async function POST(request: Request) {
  try {
    const secret = request.headers.get("x-admin-secret")?.trim();
    const expected = process.env.AUTH_SECRET?.trim();
    if (!expected || !secret || secret !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const email = body.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }

    const deleted = await deleteAllAssetsForUser(user.id);
    return NextResponse.json({ ok: true, email: user.email, deleted });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "delete failed" },
      { status: 500 },
    );
  }
}
