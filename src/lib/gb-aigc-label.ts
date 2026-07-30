/**
 * GB 45438-2025 / CAC AI-generated content labeling for character stills.
 *
 * Dual-track (explicit + implicit) so Chinese platform scanners (e.g. Seedance /
 * BytePlus) can treat the still as Confirmed AI Content (Label=1):
 *  1) Explicit corner mark: "人工智能生成合成"
 *  2) Implicit metadata: EXIF ImageDescription/UserComment + XMP tc260:AIGC JSON
 *
 * Applied as a post-pass AFTER the frozen AI digital filter (does not change
 * filter numbers). Re-exports JPEG so labels survive the pipeline.
 */

import { createHash, randomBytes } from "node:crypto";
import sharp from "sharp";

export const GB_AIGC_PROVIDER = "Veronix.ai";
export const GB_AIGC_PROPAGATOR = "vyronix.app";
/** Label=1 → confirmed AI-generated / synthesized (GB 45438-2025 Appendix E). */
export const GB_AIGC_LABEL_CONFIRMED = "1";

export type GbAigcPayload = {
  Label: string;
  ContentProducer: string;
  ProduceID: string;
  ReservedCode1: string;
  ContentPropagator: string;
  PropagateID: string;
  ReservedCode2: string;
};

function asciiSafe(value: string, max = 120): string {
  return value
    .replace(/[^\x21\x23-\x5B\x5D-\x7E.]/g, "")
    .slice(0, max) || "Veronix";
}

export function buildGbAigcPayload(opts?: {
  contentId?: string;
  timestamp?: Date;
}): { payload: GbAigcPayload; envelope: string; timestampIso: string; contentId: string } {
  const timestamp = opts?.timestamp ?? new Date();
  const timestampIso = timestamp.toISOString().replace(/\.\d{3}Z$/, "Z");
  const contentId =
    opts?.contentId ||
    `VX${timestamp.getTime().toString(36).toUpperCase()}${randomBytes(4).toString("hex").toUpperCase()}`;

  // AI confirmation code (integrity): SHA-256 over provider + id + timestamp.
  const confirmCode = createHash("sha256")
    .update(`${GB_AIGC_PROVIDER}|${contentId}|${timestampIso}|AIGC`)
    .digest("hex")
    .slice(0, 40);

  const payload: GbAigcPayload = {
    Label: GB_AIGC_LABEL_CONFIRMED,
    ContentProducer: asciiSafe(GB_AIGC_PROVIDER),
    ProduceID: asciiSafe(contentId, 64),
    ReservedCode1: confirmCode,
    ContentPropagator: asciiSafe(GB_AIGC_PROPAGATOR),
    PropagateID: asciiSafe(contentId, 64),
    // computer,1|human,0| + ISO timestamp (provider-specific reserved).
    ReservedCode2: asciiSafe(`computer,1|human,0|ts:${timestampIso}`),
  };

  const envelope = JSON.stringify({ AIGC: payload });
  return { payload, envelope, timestampIso, contentId };
}

function buildExplicitLabelSvg(width: number, height: number): Buffer {
  const fontSize = Math.max(11, Math.round(Math.min(width, height) * 0.028));
  const padX = Math.max(8, Math.round(width * 0.02));
  const padY = Math.max(8, Math.round(height * 0.018));
  const boxH = Math.round(fontSize * 2.55);
  const boxW = Math.min(width - padX * 2, Math.round(fontSize * 13.5));
  const x = width - padX - boxW;
  const y = height - padY - boxH;

  // Semi-transparent corner badge — GB appendix C.2 style (lower-right).
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="${Math.round(fontSize * 0.35)}"
    fill="rgba(0,0,0,0.42)"/>
  <text x="${x + boxW / 2}" y="${y + fontSize * 1.05}"
    text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
    font-size="${fontSize}" font-weight="700" fill="rgba(255,255,255,0.92)">人工智能生成合成</text>
  <text x="${x + boxW / 2}" y="${y + fontSize * 2.05}"
    text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
    font-size="${Math.max(9, Math.round(fontSize * 0.72))}" font-weight="600"
    fill="rgba(255,255,255,0.78)">AI Generated</text>
</svg>`;
  return Buffer.from(svg);
}

function buildTc260Xmp(envelopeJson: string, timestampIso: string, contentId: string): string {
  // Attribute form used by Chinese scanners: tc260:AIGC="{...}"
  const escaped = envelopeJson
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
   xmlns:dc="http://purl.org/dc/elements/1.1/"
   xmlns:xmp="http://ns.adobe.com/xap/1.0/"
   xmlns:tc260="http://www.tc260.org.cn/ns/AIGC/1.0/"
   dc:creator="Veronix.ai"
   dc:description="AI-generated synthesized character still (GB 45438-2025)"
   xmp:CreatorTool="Veronix.ai"
   xmp:CreateDate="${timestampIso}"
   tc260:AIGC="${escaped}"
   tc260:Label="1"
   tc260:ContentProducer="Veronix.ai"
   tc260:ProduceID="${contentId}"/>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/**
 * Burn explicit corner mark + inject GB 45438 AIGC metadata, then re-export JPEG.
 */
export async function applyGbAigcLabeling(
  bytes: Buffer,
  opts?: { contentId?: string; skipExplicit?: boolean },
): Promise<Buffer> {
  const { envelope, timestampIso, contentId } = buildGbAigcPayload({
    contentId: opts?.contentId,
  });

  const base = sharp(bytes, { failOn: "none" }).rotate();
  const meta = await base.metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;
  if (width < 32 || height < 32) {
    throw new Error("Image too small for GB AIGC labeling");
  }

  let pipeline = sharp(bytes, { failOn: "none" }).rotate().removeAlpha().toColorspace("srgb");

  if (!opts?.skipExplicit) {
    const overlay = await sharp(buildExplicitLabelSvg(width, height))
      .png()
      .toBuffer();
    pipeline = pipeline.composite([{ input: overlay, blend: "over" }]);
  }

  const labeled = await pipeline
    .jpeg({ quality: 88, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .withMetadata({
      density: 72,
      exif: {
        IFD0: {
          // Implicit AIGC JSON (GB Appendix E) — scanners look for "AIGC" keyword.
          ImageDescription: envelope,
          UserComment: envelope,
          Software: "Veronix.ai GB45438-AIGC",
          Artist: "Veronix.ai",
          Copyright: `AIGC Label=1 ProduceID=${contentId}`,
          DateTime: timestampIso.replace("T", " ").replace("Z", ""),
        },
      },
    })
    .withXmp(buildTc260Xmp(envelope, timestampIso, contentId))
    .toBuffer();

  return labeled;
}

/** True when buffer already carries GB / TC260 AIGC markers. */
export function hasGbAigcMarkers(bytes: Buffer): boolean {
  const head = bytes.subarray(0, Math.min(bytes.length, 256_000)).toString("latin1");
  return (
    head.includes('"AIGC"') ||
    head.includes("tc260:AIGC") ||
    head.includes("人工智能生成合成")
  );
}
