import { NextResponse } from "next/server";
import {
  adjustCredits,
  findUserByEmail,
  listUsersForAdmin,
  updateUser,
} from "@/lib/db";

export const runtime = "nodejs";

type Body = {
  email?: string;
  credits?: number;
  /** Set absolute balance instead of adding */
  setTo?: number;
  /** List users (email/credits/plan only) for ops */
  list?: boolean;
};

/**
 * Temporary test-credit grant for ops. Requires x-admin-secret = AUTH_SECRET.
 * Cap: 20_000 per call.
 */
export async function POST(request: Request) {
  try {
    const secret = request.headers.get("x-admin-secret")?.trim();
    const expected = process.env.AUTH_SECRET?.trim();
    if (!expected || !secret || secret !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as Body;
    if (body.list) {
      const users = await listUsersForAdmin();
      return NextResponse.json({ users });
    }

    const email = body.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let nextCredits = user.credits;
    if (typeof body.setTo === "number" && Number.isFinite(body.setTo)) {
      nextCredits = Math.max(0, Math.min(50_000, Math.floor(body.setTo)));
      await updateUser(user.id, { credits: nextCredits });
    } else {
      const delta = Math.max(0, Math.min(20_000, Math.floor(Number(body.credits) || 0)));
      if (!delta) {
        return NextResponse.json({ error: "credits or setTo required" }, { status: 400 });
      }
      const updated = await adjustCredits(user.id, delta);
      nextCredits = updated.credits;
    }

    return NextResponse.json({
      ok: true,
      email: user.email,
      credits: nextCredits,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "grant failed" },
      { status: 500 },
    );
  }
}
