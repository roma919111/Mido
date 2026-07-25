import type { NextRequest } from "next/server";
import { POST as generatePost } from "../generate/route";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Alias for /api/generate — some temporary tunnels mishandle that path. */
export async function POST(request: NextRequest) {
  return generatePost(request);
}
