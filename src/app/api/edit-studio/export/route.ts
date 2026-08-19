import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import {
  exportEditStudioOnServer,
  serverEditExportAvailable,
} from "@/lib/edit-studio-server-export";
import { normalizeExportQuality, type EditStudioExportQuality } from "@/lib/edit-studio-export-quality";
import type { TimelineClip } from "@/lib/edit-studio-timeline";

export const runtime = "nodejs";
export const maxDuration = 300;

type Body = {
  clips?: TimelineClip[];
  quality?: EditStudioExportQuality;
  merge?: boolean;
};

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Login required", needsAuth: true }, { status: 401 });
    }
    if (!serverEditExportAvailable()) {
      return NextResponse.json({ error: "Server export disabled" }, { status: 503 });
    }

    const body = (await request.json()) as Body;
    const clips = Array.isArray(body.clips) ? body.clips : [];
    if (!clips.length) {
      return NextResponse.json({ error: "No clips" }, { status: 400 });
    }

    const quality = normalizeExportQuality(body.quality);
    const merge = body.merge !== false;

    const bytes = await exportEditStudioOnServer({ clips, quality, merge });

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="vyronix-export.mp4"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
