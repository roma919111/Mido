import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { probeAllBytePlusVideoAuth } from "@/lib/byteplus-ark";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Owner-only — live BytePlus / Seedance auth check (no secrets returned). */
export async function GET() {
  try {
    await requireAdminUser();
    const probes = await probeAllBytePlusVideoAuth();
    return NextResponse.json({
      ok: probes.vyronix.ok && probes.seedance2.ok,
      probes,
      hint:
        "Create ARK API keys at console.byteplus.com → ModelArk → API Key Management. Set BYTEPLUS_API_KEY (+ optional BYTEPLUS_SEEDANCE_2_API_KEY) on Railway.",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Forbidden";
    const status = msg.includes("Forbidden") || msg.includes("Admin") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
