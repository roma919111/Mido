import { readFile } from "node:fs/promises";
import { resolveGenerationFile } from "@/lib/veronix-outro";

export async function uploadLocalFileToDrive(input: {
  accessToken: string;
  localUrl: string;
  filename: string;
  mimeType?: string;
}): Promise<{ id: string; webViewLink?: string }> {
  const filePath = resolveGenerationFile(input.localUrl);
  if (!filePath) {
    throw new Error("Only local Vyronix videos can be uploaded to Drive");
  }

  const bytes = await readFile(filePath);
  const mimeType = input.mimeType || "video/mp4";
  const metadata = {
    name: input.filename,
    mimeType,
  };

  const boundary = `vyronix_${Date.now()}`;
  const preamble = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    "utf8",
  );
  const epilogue = Buffer.from(`\r\n--${boundary}--`, "utf8");
  const body = Buffer.concat([preamble, bytes, epilogue]);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  const data = (await res.json()) as {
    id?: string;
    webViewLink?: string;
    error?: { message?: string };
  };

  if (!res.ok || !data.id) {
    throw new Error(data.error?.message || `Drive upload failed (${res.status})`);
  }

  return { id: data.id, webViewLink: data.webViewLink };
}
