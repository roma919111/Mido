import { NextResponse } from "next/server";
import {
  callOpenArtTool,
  OpenArtConfigError,
  parseToolPayload,
} from "@/lib/openart-mcp";
import type { VisualReference } from "@/lib/types";

export const runtime = "nodejs";

const MCP_ENDPOINT = process.env.OPENART_MCP_URL ?? "https://mcp.openart.ai/mcp";

export async function POST(request: Request) {
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
        {
          error: payload.rawText ?? "Failed to sign upload",
          live: true,
          mcpEndpoint: MCP_ENDPOINT,
          details: payload,
          raw: signResult,
        },
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

    const visualReference =
      (signed.visualReference as VisualReference | undefined) ??
      ((signed.visualReferences as VisualReference[] | undefined)?.[0] as
        | VisualReference
        | undefined);

    if (!signURL) {
      return NextResponse.json(
        {
          error: "Upload sign response missing signURL",
          live: true,
          mcpEndpoint: MCP_ENDPOINT,
          details: signed,
          raw: signResult,
        },
        { status: 502 },
      );
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
      const detail = await putResponse.text().catch(() => "");
      return NextResponse.json(
        {
          error: `Upload PUT failed (${putResponse.status})`,
          detail,
          live: true,
          mcpEndpoint: MCP_ENDPOINT,
        },
        { status: 502 },
      );
    }

    let reference = visualReference;
    const mediaUrl = accessURL ?? reference?.url;

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
            reference = meta.visualReference as VisualReference;
          }
        }
      } catch {
        // metadata is optional for some models
      }
    }

    if (!reference) {
      reference = {
        type: "image",
        id: mediaUrl ?? file.name,
        url: mediaUrl ?? "",
        label,
      };
    }

    return NextResponse.json({
      visualReference: reference,
      accessURL: mediaUrl,
      live: true,
      mcpEndpoint: MCP_ENDPOINT,
      details: signed,
      raw: signResult,
    });
  } catch (error) {
    if (error instanceof OpenArtConfigError) {
      return NextResponse.json(
        {
          error: error.message,
          live: false,
          mcpEndpoint: MCP_ENDPOINT,
        },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Upload failed",
        live: true,
        mcpEndpoint: MCP_ENDPOINT,
        details:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : { error },
      },
      { status: 500 },
    );
  }
}
