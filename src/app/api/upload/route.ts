import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  callOpenArtTool,
  isOpenArtConfigured,
  OpenArtConfigError,
  parseToolPayload,
} from "@/lib/openart-mcp";
import type { VisualReference } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in to upload" }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    const purpose = String(form.get("purpose") ?? "create-video");
    const label = String(form.get("label") ?? "upload");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image uploads are supported" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const localDataUrl = `data:${file.type};base64,${bytes.toString("base64")}`;

    if (!isOpenArtConfigured()) {
      const visualReference: VisualReference = {
        type: "image",
        id: `local_${Date.now()}`,
        url: localDataUrl,
        label,
      };
      return NextResponse.json({
        visualReference,
        accessURL: localDataUrl,
        demo: true,
      });
    }

    const signResult = await callOpenArtTool("openart_upload_sign", {
      mediaType: "image",
      filename: file.name || "upload.png",
      size: bytes.byteLength,
      contentType: file.type || "image/png",
      label,
      purpose: purpose === "create-image" ? "create-image" : "create-video",
    });

    if (signResult.isError) {
      const payload = parseToolPayload(signResult);
      return NextResponse.json(
        { error: payload.rawText ?? "Failed to sign upload" },
        { status: 502 },
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
      return NextResponse.json({ error: "Upload sign response missing signURL" }, { status: 502 });
    }

    const putResponse = await fetch(signURL, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "image/png",
        "Content-Length": String(bytes.byteLength),
      },
      body: bytes,
    });

    if (!putResponse.ok) {
      return NextResponse.json(
        { error: `Upload PUT failed (${putResponse.status})` },
        { status: 502 },
      );
    }

    const mediaUrl = accessURL ?? visualReference?.url;
    if (mediaUrl) {
      try {
        const metaResult = await callOpenArtTool("openart_upload_metadata_get", {
          mediaUrl,
          mediaType: "image",
          label,
        });
        if (!metaResult.isError) {
          const meta = parseToolPayload(metaResult);
          if (meta.visualReference && typeof meta.visualReference === "object") {
            visualReference = meta.visualReference as VisualReference;
          }
        }
      } catch {
        // optional
      }
    }

    if (!visualReference) {
      visualReference = {
        type: "image",
        id: mediaUrl ?? file.name,
        url: mediaUrl ?? localDataUrl,
        label,
      };
    }

    return NextResponse.json({ visualReference, accessURL: mediaUrl });
  } catch (error) {
    if (error instanceof OpenArtConfigError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    );
  }
}
