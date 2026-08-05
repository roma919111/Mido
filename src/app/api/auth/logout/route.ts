import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json({ ok: true, message: "No owner session to clear." });
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "No owner session to clear." });
}
