/** Alias used by AI Rental LTX UI — same proxy as /api/media/stream. */
import { GET as mediaStreamGet } from "@/app/api/media/stream/route";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request) {
  return mediaStreamGet(request);
}
