import { NextResponse } from "next/server";
import { access } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

/** Lightweight liveness probe for Railway healthchecks. */
export async function GET() {
  const dataDir = path.join(process.cwd(), ".data");
  let dataDirOk = false;
  try {
    await access(dataDir);
    dataDirOk = true;
  } catch {
    dataDirOk = false;
  }

  return NextResponse.json({
    ok: true,
    service: "vyronix",
    dataDirOk,
    ts: new Date().toISOString(),
  });
}
