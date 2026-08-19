import { unlink } from "node:fs/promises";
import { resolveGenerationFile } from "@/lib/veronix-outro";

/** Delete a local /generations/* file from disk if present. */
export async function unlinkGenerationUrl(url: string | null | undefined): Promise<boolean> {
  const filePath = url ? resolveGenerationFile(url) : null;
  if (!filePath) return false;
  try {
    await unlink(filePath);
    return true;
  } catch {
    return false;
  }
}
