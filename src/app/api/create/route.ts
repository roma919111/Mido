import type { NextRequest } from "next/server";
import { POST as generatePost } from "../generate/route";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  return generatePost(request);
}
