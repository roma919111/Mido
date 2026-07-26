import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/customer-auth";
import {
  callOpenArtTool,
  OpenArtConfigError,
  parseToolPayload,
} from "@/lib/openart-mcp";
import type { VisualReference } from "@/lib/types";
import { extractLastFrameJpeg } from "@/lib/video-stitch";

export const runtime = "nodejs";
export const maxDuration = 120;

type Body = {
  videoUrl?: string;
  label?: string;
};

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Login required", needsAuth: true }, { status: 401 });
    }

    const body = (await request.json()) as Body;
    const videoUrl = body.videoUrl?.trim();
    if (!videoUrl) {
      return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
    }

    const jpeg = await extractLastFrameJpeg(videoUrl);
    const label = body.label?.trim() || `shot-frame-${Date.now()}`;
    const filename = `${label.replace(/[^\w.-]+/g, "-").slice(0, 40)}.jpg`;

    const signResult = await callOpenArtTool("openart_upload_sign", {
      mediaType: "image",
      filename,
      size: jpeg.byteLength,
      contentType: "image/jpeg",
      label,
      purpose: "create-video",
    });
    if (signResult.isError) {
      const payload = parseToolPayload(signResult);
      return NextResponse.json(
        { error: payload.rawText ?? "Failed to sign frame upload", details: payload },
        { status: 422 },
      );
    }

    const signed = parseToolPayload(signResult);
    const signURL =
      (signed.signURL as string | undefined) ??
      (signed.signUrl as string | undefined) ??
      (signed.uploadUrl as string | undefined);
    const accessURL =
      (signed.accessURL as string | undefined) ??
      (signed.accessUrl as string | undefined) ??
      (signed.url as string | undefined);
    let visualReference =
      (signed.visualReference as VisualReference | undefined) ??
      ((signed.visualReferences as VisualReference[] | undefined)?.[0] as
        | VisualReference
        | undefined);

    if (!signURL) {
      return NextResponse.json({ error: "Upload sign missing signURL" }, { status: 422 });
    }

    const putResponse = await fetch(signURL, {
      method: "PUT",
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(jpeg.byteLength),
      },
      body: jpeg,
    });
    if (!putResponse.ok) {
      const detail = await putResponse.text().catch(() => "");
      return NextResponse.json(
        { error: `Frame upload PUT failed (${putResponse.status})`, detail },
        { status: 422 },
      );
    }

    if (!visualReference && accessURL) {
      visualReference = {
        type: "image",
        id: accessURL,
        url: accessURL,
        label,
      };
    }

    // Best-effort metadata enrichment for Seedance
    if (accessURL) {
      try {
        const meta = await callOpenArtTool("openart_upload_metadata_get", {
          mediaUrl: accessURL,
          mediaType: "image",
          uploadId: visualReference?.id || accessURL,
          label,
        });
        if (!meta.isError) {
          const payload = parseToolPayload(meta);
          const enriched = payload.visualReference as VisualReference | undefined;
          if (enriched?.url) visualReference = enriched;
        }
      } catch {
        // optional
      }
    }

    if (!visualReference?.url) {
      return NextResponse.json({ error: "Frame upload produced no visualReference" }, { status: 422 });
    }

    return NextResponse.json({ visualReference, url: visualReference.url });
  } catch (error) {
    if (error instanceof OpenArtConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "extract-frame failed" },
      { status: 500 },
    );
  }
}
